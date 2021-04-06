import * as fs from "fs";
import * as md from "markdown-it";

class Location {
  constructor(
      public filename: string,
      public lineno: number, 
      public totalLineno: number) {
  }
  toString(): string {
      return this.filename + ":" + this.lineno;
  }
}

enum PromiseKind {
  mentioned, 
  made,
  fullfilled,
}

type Tag = string;
type Tag2LocList = Map<Tag, Array<Location>>;

class Doc {
  constructor(
      public promises: Array<[Location, Tag, PromiseKind]>,
      public pMentioned: Tag2LocList,
      public pMade: Tag2LocList,
      public pFullfilled: Tag2LocList,
  ) {}
}

function info(loc: Location, tag: Tag, message: string) {
  console.log(`${loc}: info ${tag} ${message}`);
}

function warning(loc: Location, tag: Tag, message: string) {
  console.log(`${loc}: warning ${tag} ${message}`);
}

function error(loc: Location, tag: Tag, message: string) {
  console.log(`${loc}: error ${tag} ${message}`);
}

function setOrAdd(set: Tag2LocList, key: Tag, value: Location) {
  if (set.has(key)) {
      set.get(key)?.push(value);
  } else {
      set.set(key, [value]);
  }
}

function scanFiles(files: Array<string>): Doc {
  let promises: Array<[Location, Tag, PromiseKind]> = new Array();
  let pMentioned: Tag2LocList = new Map();
  let pMade: Tag2LocList = new Map();
  let pFullfilled: Tag2LocList = new Map();
  let totalLineno = 0;

  for (const filename of files) {
      let lineno = 1;
      for(const line of fs.readFileSync(filename, 'utf8').split(/\r\n|\n\r|\n|\r/g)) {
          const m = line.match(/<!--(.*?)-->/);
          if (m) { // process one line comment only
              for(const token of m[0].split(/\s/)) {
                  if (token.charAt(0)==='#') {
                      const loc = new Location( filename, lineno, totalLineno );
                      let tag = token.substr(1);
                      if (tag.endsWith('?')) {
                          tag = tag.substr(0, tag.length-1);
                          promises.push([loc, tag, PromiseKind.made]); 
                          setOrAdd(pMade, tag, loc);
                      } else if (tag.endsWith('!')) {
                          tag = tag.substr(0, tag.length-1);
                          promises.push([loc, tag, PromiseKind.fullfilled]); 
                          setOrAdd(pFullfilled, tag, loc);
                      } else {
                          promises.push([loc, tag, PromiseKind.mentioned]); 
                          setOrAdd(pMentioned, tag, loc);
                      }
                  }
              }
          }
          lineno++;
          totalLineno++;
      }
  }
  return new Doc(promises, pMentioned, pMade, pFullfilled);
}

function checkPromises(doc: Doc, verbose: boolean, warnDuplicate: boolean ) {
  for(const [loc, tag, kind] of doc.promises) {
      switch(kind) {
          case PromiseKind.mentioned: 
              if (verbose) {
                  info(loc, tag, "mentioned");
              } 
              break;
          case PromiseKind.made: 
              if (warnDuplicate && loc!==doc.pMade.get(tag)?.[0]) {
                  warning(loc, tag, "duplicate promise.");
              }
              if (!doc.pFullfilled.has(tag)) {
                  error(loc, tag, "not fullfilled.");
              }
              break;
          case PromiseKind.fullfilled:
              if (warnDuplicate && loc!==doc.pFullfilled.get(tag)?.[0]) {
                  warning(loc, tag, "duplicate fullfillment.");
              }
              if (doc.pMade.has(tag)) {
                  const mades = doc.pMade.get(tag);
                  if (loc.totalLineno<mades![mades!.length-1].totalLineno) {
                      error(loc, tag, "fullfilled before promise");
                  }
              } else {
                  error(loc, tag, "fullfilled without promise");
              }
      }
  }
}

// async function main() {
//   const args = yargs.options({
//     'v': { type: 'boolean', default: false, alias: 'verbose' },
//     'd': { type: 'boolean', default: false, alias: 'warn-duplicate' },
//   }).argv;
//     // console.log(args);
//   const doc = scanFiles(args["_"] as Array<string>);
//   checkPromises(doc, args.v, args.d);
// }

// main();
