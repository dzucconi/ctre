/** Turns on paranoid correctness checks. */
CT.prototype.leery = true;

CT.$ = {
    '<' : "\u0008", // del char
    '>' : "\u007F", // undel char
    'x' : "[\u0008\u007F]", // del/undel char
    'X' : "[^\u0008\u007F]", // not a del/undel char
    'b' : "\u0001",  // ascii beginning symbol
    'e' : "\u0004", // ascii end symbol
    'f' : "[0-\uffff]", // feed id
    'o' : "[0-\uffff]", // offset
    '2' : "(?:[0-\uffff][0-\uffff])", // feed+offset
    '4' : "(?:(?:[0-\uffff][0-\uffff]){2})", // feed+offset twice
    '5' : "(?:.(?:[0-\uffff][0-\uffff]){2})", // form5
    'z' : "(?:\u007F*\u0008)", // 1-form del-undel block
    'Z' : "(?:(?:\u007F..)*\u0008..)", // 3-form del-undel
    '%' : "(?:(?:\u007F....)*\u0008....)" // 5-form del-undel
};

/** Dynamically composed regexes are even less readable using the standard
 notation new RegExp("abc"+x+"."+y,"g") etc. Thus, I use template regexes
 defined as /abc$x.$y/g. */
CT.fill = function (template,values) {
    if (!template.replace)
        throw "supply a template string";
    function replacer(match,letter) {
        var ret = CT.$[letter] || (values && values[letter]);
        return ret || match;
    }
    var re_str = template.replace(/\$(.)/g,replacer);
    return re_str;
}

CT.re = function (template,values,flags) {
    var expr = CT.fill(template,values);
    return new RegExp(expr,flags||"gm");
}

CT.prototype.re_wv5csyn = 
    CT.re("^$b0000($X$4(($>$4)*$<$4)*)*$e0001(.$4)*$");
/** Causal Trees (CT) version control implementation. For the theory see
 *  Victor Grishchenko "Deep hypertext with embedded revision control
 *  implemented in regular expressions"
 *  http://portal.acm.org/citation.cfm?id=1832772.1832777 */
function CT (weave5c,roster) {
    if (this.leery && weave5c && !weave5c.match(this.re_wv5csyn))
        throw "invalid weave5c";
    // these two are the only "primary" members; the rest is derived
    this.weave5c = weave5c || "\u00010000\u00040001";
    this.roster = roster || new CTRoster();
}

CT.prototype.clone = function () {
    return new CT(this.weave5c,this.roster);
}

function CTRoster (id2url) {
    this.url2id = {};
    this.id2url = id2url || {};
    for(var code in this.id2url)
        this.url2id[this.id2url[code]] = code;
    var defyarn = "\u0001--default yarn--\u0004";
    this.url2id[defyarn] = '0';
    this.id2url['0'] = defyarn;
}

CTRoster.prototype.addAuthor = function (url,code) {
    if (!code) {
        var ids = this.getSortedYarnIds();
        code = String.fromCharCode(ids.charCodeAt(ids.length-1)+1);
    }
    this.sorted = undefined;
    this.url2id[url] = code;
    this.id2url[code] = url;
}

CTRoster.prototype.re_yarnidclean = /[^\0]+\0(.)\0/g;
CTRoster.prototype.getSortedYarnIds = function () {
    if (this.sorted)
        return this.sorted;
    var srt = [], ids = [];
    for(var yarn_url in this.url2id)
        srt.push(yarn_url);
    srt.sort();
    for(var i=0; i<srt.length; i++)
        ids.push(this.url2id[srt[i]]);
    return this.sorted = ids.join('');
}

CTRoster.prototype.recodeTo = function (form5c, roster) {
    return recoded;
}


CT.prototype.re_weave2weft = /...(..)/g;
/** Returns the current revision's vector timestamp (i.e. a weft) in the
    canonic form (no redundancy, sorted by yarn id). */
CT.prototype.getWeft2 = function () {
    if (this.weft2) return this.weft2; 
    var raw = this.weave5c.replace(this.re_weave2weft,"$1");
    this.weft2 = CT.dryWeft2(raw);
    return this.weft2;
}

CT.prototype.getWeave5c = function () {
    return this.weave5c;
}

/*CT.prototype.allocateYarnCode = function () {
    var ids = this.getSortedYarnIds();
    if (ids==="0") return "A";
    return String.fromCharCode(ids.charCodeAt(ids.length-1)+1);
}*/

CT.prototype.re_3to1 = /(.)../g;
/** Returns the current version in almost-plain text (still has markers, e.g.
 *  \1 in the beginning and \4 in the end.  */
CT.prototype.getText1 = function () {
    return this.text1 || (this.text1=this.getText3().replace(this.re_3to1,"$1"));
}

CT.prototype.re_5cto3 = /(.)..(..)/g;
/** Returns the 3-form of the text, i.e. symbol-author-offset tuples. */
CT.prototype.getText3 = function () {
    return this.text3 || (this.text3=this.getText5c().replace(this.re_5cto3,"$1$2"));
}

CT.prototype.getWeave3 = function () {
    return this.weave3 || (this.weave3=this.weave5c.replace(this.re_5cto3,"$1$2"));
}

CT.prototype.re_scouring = 
    CT.re(".{5}(?:(?:$>....)+$<....)*$<....(?:$x....)*|(.{5})(?:$x....)*");
CT.prototype.re_weave5c = CT.re("^$b0000((?:...[^0].)*)$e0001((?:.{5})*)$",CT.$,"m");
// any deleted and undeleted but finally deleted    OR    whatever
/** Text5c is derived from weave5c by scouring. */
CT.prototype.getText5c = function () {
    if (this.text5c) return this.text5c;
    var parse = this.weave5c.match(this.re_weave5c);
    if (!parse) throw "weave format error";
    var body = parse[1] || '';
    var stash = parse[2] || '';
    this.text5c =  body.replace(this.re_scouring,"$1");
    return this.text5c;
}

CT.prototype.re_deps = /.(.).\1.|.(....)/g;
/** Deps4 contains inter-feed causal dependencies. */
CT.prototype.getDeps4c = function () {
    return this.deps4c || (this.deps4c=this.weave5c.replace(this.re_deps,"$2"));
}

CT.re_meta = /([\\\.\^\$\*\+\?\(\)\[\]\{\}\:\=\!\|\,\-])/g;
CT.escapeMeta = function (re_str) {
    return re_str.replace(CT.re_meta,"\\$1");
}

CT.re_filt = /(\\.|.)(\\.|.)/g;
CT.re_weft2syn = CT.re("^($2)+$");
CT.re_filtre = {
    "li":"|$1[0-$2]",
    "ri":"|$1[$2-\uffff]",
    "lx":"|$1[^0-$2]",
    "rx":"|$1[^$2-\uffff]"
};
/** Filtre is a regex matching atom ids under the weft. Filtres are mostly
    useful for filtering weaves/whatever according to wefts,
    i.e. for restoring/checking against historical state. */
CT.getFiltre = function (weft2,mode) {
    if (this.leery && !weft2.match(CT.re_weft2syn)) throw "not a weft2";
    var escaped = CT.escapeMeta(weft2);
    var expr = CT.re_filtre[mode||"li"];
    var filtre = escaped.replace(CT.re_filt,expr);
    return filtre.substr(1);
}

/** Exclusive filtre, i.e. [0-x) instead of [0-x]. */
CT.getExFiltre = function (weft2) {
    return CT.getFiltre(weft2,"rx");
}

CT.re_nordn = /(.).(\1.)+|(..)/g;
/** Returns canonic weft2 form: sorted by yarn id, no redundancy. */
CT.dryWeft2 = function (weft2) {
    var ids = weft2.match(/../g); // PERF massive String creation
    var sorted = ids.sort().join('');
    var dered = sorted.replace(this.re_nordn,"$2$3");
    return dered;
}

CT.re_pair = /(.)(.)\1.|../mg;
CT.commonWeft2 = function (wefta, weftb) {
    var arr = (wefta+weftb).match(/../mg);
    var merged = arr.sort().join('');
    var ret = merged.replace(CT.re_pair,"$1$2");
    return ret;
}

CT.prototype.re_trans = "(..)($W)|....";
/** Make a transitive closure of causal dependencies; return a closed weft. */
CT.prototype.closeWeft2 = function (weft2) {
    var w2 = null;
    while (weft2!=w2) {
        w2 = weft2;
        var re_covered = CT.re(this.re_trans,{'W':CT.getFiltre(weft2)});
        var covers = this.getDeps4c().replace(re_covered,"$1");
        weft2 = CT.dryWeft2(weft2+covers+"01");
    }
    return weft2;
}

/** Returns the last known offset in the yarn, an empty string otherwise. */
CT.getYarnLength = function (weft2,yarnid) {
    if (!yarnid || yarnid.length!=1)
        throw "no yarn id provided";
    var re = new RegExp("^(?:..)*?"+yarnid+"(.)");
    var m = weft2.match(re);
    return m ? m[1] : '';
}

CT.prototype.re_form2 = /../g;
CT.prototype.re_w2diff = /(..)\1|(.).(\2).|(.)./g;
CT.prototype.re_notinset = "[^$S]";
/** Compare two weft2s according to the weftI-ordering (see the paper). */
CT.prototype.compareWeft1 = function (weft2a,weft2b) {
    var split = (weft2a+weft2b).match(this.re_form2);
    var sorted = split.sort().join('');
    var diff = sorted.replace(this.re_w2diff,"$3$4");
    if (!diff)
        return 0;
    var re_srch = CT.re( this.re_notinset, {'S':CT.escapeMeta(diff)} );
    var srt_diff = this.roster.getSortedYarnIds().replace(re_srch,"");
    var win = srt_diff.charAt(0);
    return CT.getYarnLength(weft2a,win) > CT.getYarnLength(weft2b,win) ? 1 : -1;
}

CT.prototype.getYarnLength = function (yarnid) {
    return CT.getYarnLength(this.getWeft2(),yarnid);
}

CT.prototype.getYarnAwareness = function (yarnid) {
    if (!this.awareness) this.awareness={};
    if (this.awareness[yarnid]) return this.awareness[yarnid];
    var len = this.getYarnLength(yarnid);
    if (!len) return "01";
    return this.awareness[yarnid]=this.closeWeft2(yarnid+len);
}

CT.prototype.re_causal_block =
    "^((?:.{5})*?)(...$R)((?:.$R..(?:.{5})*?)*)(.(?:$W).*)$";
CT.prototype.re_siblings = ".$R..(?:.{5})*?(?=.$R..|$)";
/** In case optimizations fail, the weave is patched using this method.
    It involves complex parsing and building of closed weft1, i.e. is
    is expensive. On the bright side, it is rarely invoked. */
CT.prototype.addChunk5cHardcore = function (chunk5c) {
    var root = chunk5c.substr(1,2);
    var head = chunk5c.substr(3,2);
    var root_aw_weft = this.closeWeft2(root);
    var re_root_aw = CT.getFiltre(root_aw_weft);
    var re_split = CT.re( this.re_causal_block, {'R':root,'W':re_root_aw}, 'm' );
    var split = this.weave5c.match(re_split);
    if (!split) throw "cannot find the attachment point";
    var beginning = split[1];
    var attach = split[2];
    var caused = split[3];
    var end = split[4];
    var head_aw_weft = this.closeWeft2(head+chunk5c.substr(1,2));
    var siblings = caused.match( CT.re( this.re_siblings, {'R':root}, 'gm') );
    var i=0;
    for(; i<siblings.length; i++) {
        var sib_aw_weft = this.closeWeft2(siblings[i].substr(3,2));
        if (this.compareWeft1(head_aw_weft,sib_aw_weft)==1)
            break;
    }
    siblings.splice(i,0,chunk5c);
    return beginning + attach + siblings.join('') + end;
}

CT.prototype.re_patch =
    "^((?:.{5})*?)(...$C(?:$x....)*)(...(?:$A).*)$";
/** The streamlined weave patching method. May fail in case of unaware
    (i.e. concurrent) siblings. */
CT.prototype.addChunk5c = function (chunk5c) {
    var cause = chunk5c.substr(1,2);
    var head = chunk5c.substr(3,2);
    var aware = this.getYarnAwareness(head[0]);
    var re_aware = CT.getFiltre(aware+cause);
    var re_find = CT.re(this.re_patch, {'C':CT.escapeMeta(cause),'A':re_aware}, 'm');
    var new_weave5c = this.weave5c.replace(re_find,"$1$2"+chunk5c+"$3");
    if (new_weave5c.length!=this.weave5c.length+chunk5c.length)
        return null;
    return new_weave5c;
}

//CT.prototype.re_findvictim = /((?:.....)*?...($M))((?:.....)*?)(?=$|...($M))/g;
CT.prototype.re_form5c = CT.re("(.)($2)($2)");
CT.prototype.addDeletionChunk5c = function (chunk5c) {
    var head = chunk5c.substr(3,2);
    var ids = CT.escapeMeta(chunk5c.replace(this.re_form5c,"$2"));
    var re_ids = ids.match(CT.re_filt).join('|');
    var re_victim = new RegExp("((?:.....)*?...("+re_ids    // PAIN
            +"))((?:.....)*?)(?=$|...("+re_ids+"))","gm");
    var maparr = chunk5c.replace(this.re_form5c,"-$2-$3").split('-').reverse();
    maparr.pop();
    var map = {};
    while (maparr.length)
        map[maparr.pop()] = maparr.pop();
    function delatom (match,head,id,tail) {
        return head+'\u0008'+id+map[id]+tail;
    }
    var w5c = this.weave5c.replace (re_victim,delatom);
    return w5c;
}

CT.prototype.re_find_undo = "($5*?)($<$C)($A)($5*?)(?=$|.$2$C)";
CT.prototype.addUndeletionChunk5c = function (chunk5c) {
    var head = chunk5c.substr(3,2);
    var aw = this.closeWeft2(head); // TODO optimize
    var aw_filtre = "(?:"+CT.getFiltre(aw)+")";
    var ids = CT.escapeMeta(chunk5c.replace(this.re_form5c,"$2"));
    var re_ids = "(?:"+ids.replace(CT.re_filt,"|$&").substr(1)+")";
    var re = CT.re(this.re_find_undo, {'A':aw_filtre,'C':re_ids});
    var w5c = this.weave5c.replace(re,"$1\u007F$3"+head+"$2$3$4");
    return w5c;
}

CT.re_filter2 = "$F|(..)";
/** returns whether first weft covers the second */
CT.isCover = function (weft2sup, weft2sub) {
    var filtre = CT.re(CT.re_filter2,{'F':CT.getFiltre(weft2sup)});
    var remainder = weft2sub.replace(filtre,"$1");
    return remainder==='';
}

CT.prototype.re_chunk =
    CT.re("($x)..(.).(?:\\1..\\2.)*|$X..(?:(..)$X\\3)*..",CT.$);  // the Spui regex
/** The only method that mutates weave5c. Takes an array of atoms (patch5c),
    splits it into causality chains, applies chains to the weave. */
CT.prototype.addPatch5c = function (patch5c) {  // append-only order is mandatory
    if (!patch5c) return;
    this.text5c = this.text3 = this.text1 = this.weave3 = undefined;
    // check whether yarns are known
    var chunks = patch5c.match(this.re_chunk).reverse();
    var fails = 0;
    while (chunks.length && fails<chunks.length) {
        var chunk = chunks.pop();
        // check for causal deps, duplicate content
        var prev = String.fromCharCode(chunk.charCodeAt(4)-1);
        var deps = chunk.substr(1,2) + (prev=='/' ? '' : chunk[3] + prev);
        if (!CT.isCover(this.getWeft2(),deps)) {
            fails++;
            chunks.unshift(chunk);
            continue;
        }
        if (this.getYarnLength(chunk[3])>=chunk[4])
            throw "duplicate content"; // TODO cut n paste
        if (chunk[0]==='\u0008') { // deletion
            this.weave5c = this.addDeletionChunk5c(chunk);
        } else if (chunk[0]==='\u0006') { // awareness
            this.weave5c += chunk;
        } else if (chunk[0]=='\u007F') {
            this.weave5c = this.addUndeletionChunk5c(chunk);
        } else {
            this.weave5c = this.addChunk5c(chunk) || 
                this.addChunk5cHardcore(chunk);
        }
        fails = 0;
        var yarn_id = chunk[3];
        if (this.awareness)
            this.awareness[yarn_id] = undefined;
        var new_ids = chunk.replace(this.re_form5c,"$3");
        this.weft2 = CT.dryWeft2(this.weft2+new_ids);
        this.deps4c = undefined;
    }
}

CT.prototype.re_hist = "(...(?:$V))|(.....)";
/** Returns a CT object wrapping a historical version of the weave. */
CT.prototype.getVersion = function (weft2) {
    var re_fre = CT.re(this.re_hist, {'V':CT.getFiltre(weft2)});
    var weave5cver = this.weave5c.replace(re_fre,"$1");
    return new CT(weave5cver,this.roster);
}

CT.prototype.getTail5c = function (weft2) {
    var re_fre = CT.re(this.re_hist, {'V':CT.getFiltre(weft2,"li")});
    var weave5cver = this.weave5c.replace(re_fre,"$2");
    return weave5cver;
}

CT.prototype.re_form3 = /.../g;
/** Takes patch3c, adds atom ids, adds the resulting patch5c.
    Note: patch3c is already position-independent, different from offset-
    content change specification. Still, patch3c mentions no own yarn ids
    or offsets. Thus it is perfect for sending changes to the server to let
    the server assign proper offsets and return patch5c. */
CT.prototype.convertPatch3cTo5c = function (patch3c, yarn_url) {
    if (!patch3c) return '';
    var yarn_id = yarn_url.length==1 ? yarn_url : this.roster.url2id[yarn_url];
    if (!yarn_id)
        throw "unknown yarn url "+yarn_url; 
    var ylen = this.getYarnLength(yarn_id);
    var len = ylen ? ylen.charCodeAt(0) : 0x2f;
    var atoms = patch3c.match(this.re_form3);
    var form5c = [];
    for(var i=0; i<atoms.length; i++) {
        form5c.push(atoms[i].charAt(0));
        if (atoms[i].substr(1,2)==="01") { // spec val for "caused by prev"
            form5c.push(yarn_id);
            form5c.push(String.fromCharCode(len));
        } else 
            form5c.push(atoms[i].substr(1,2));
        form5c.push(yarn_id);
        form5c.push(String.fromCharCode(++len));
    }
    return form5c.join('');
}

CT.prototype.re_ctremeta = /[\u0000-\u0019]/g;
/** Remove all metasymbols, return the current version's plain text. */
CT.prototype.getPlainText = function () {
    return this.getText1().replace(this.re_ctremeta,'');
}

CT.re_f = "($Y.)|..";
CT.weft2Covers = function (weft2, atom) {
    var re_fd = CT.re(CT.re_f,{'Y':atom[0]});
    var cover = weft2.replace(re_fd,"$1");
    return cover && cover[1]>=atom[1];
}

CT.prototype.re_del3to5 = /.(..)/g;
/** Serialize text changes as a patch. Changes are detected using simple
  * heuristics (TODO: diff-match-patch). 
  * @param text1    the new text (including metasymbols)
  * @param yarn_url the URL identifying the author of the changes (optional)
  * @return         patch3c  */
CT.prototype.getPatch3c = function (text1, yarn_id) {
    var base = this;
    var base3 = base.getText3();
    var base1 = base.getText1();
    if (text1===base1)
        return this.getWeft2();
    var pref = Math.min(text1.length,base1.length);
    var pre = 0;
    while (pref>0) {
        if (base1.substr(0,pref)===text1.substr(0,pref)) {
            base1 = base1.substr(pref);
            text1 = text1.substr(pref);
            pre += pref;
        } else
            pref>>=1;
    }
    var postf = Math.min(text1.length,base1.length);
    while (postf>0) {
        if (base1.substr(base1.length-postf)===text1.substr(text1.length-postf)) {
            base1 = base1.substr(0,base1.length-postf);
            text1 = text1.substr(0,text1.length-postf);
        } else
            postf>>=1;
    }
    var changes3c = [];
    var that = this;
    function append_insertion (offset, text) {
        //sibling check goes here
        var cause = offset>0 ? base3.substr(offset*3+1-3,2) : "00";
        var sibl = offset*3<base3.length ? base3.substr(offset*3+4-3,2) : "01";
        //var w2 = yarn_id ? that.getYarnAwareness(yarn_id) : "01";
        //if (!CT.weft2Covers(w2,sibl))  // FIXME precache, amend
        if (sibl[0]!='0') if (!yarn_id || sibl[0]!=yarn_id) // optimization
            changes3c.push('\u0006'+sibl[0]+that.getYarnLength(sibl[0]));
        changes3c.push(text.charAt(0)+cause);
        changes3c.push(text.substr(1).replace(/(.)/g,"$101"));
    }
    function append_removal (offset, length) {
        var chunk = base3.substr(offset*3,length*3);
        changes3c.push(chunk.replace(/.(..)/g,"\u0008$1"));
    }
    var p;
    if (text1.length==0) { //removal
        append_removal(pre,base1.length);
    } else if (base1.length==0) {
        append_insertion(pre,text1);
    } else if (base1.length>text1.length && -1!=(p=base1.indexOf(text1))) {
        append_removal(pre,p);
        append_removal(pre+p+text1.length,base1.length-text1.length-p);
    } else if (base1.length<text1.length && -1!=(p=text1.indexOf(base1))) {
        append_insertion(pre,text1.substr(0,p));
        append_insertion(pre+base1.length,text1.substr(p+base1.length));
    } else {
        append_removal(pre,base1.length);
        append_insertion(pre,text1);
    }
    var patch3c = changes3c.join('');
    return patch3c;
}

CT.prototype.addNewVersion = function (text1,yarn_url) {
    var patch3c = this.getPatch3c(text1);
    var patch5c = this.convertPatch3cTo5c(patch3c,yarn_url);
    this.addPatch5c(patch5c);
    return this.getWeft2();
}

CT.prototype.re_pickyarn = "(...)($Y.)|.....";
CT.prototype.re_improper5 = /(..)(.)(..)/mg;
CT.prototype.getYarn5c = function (yarn_id) {
    if (this.leery && yarn_id.length!=1) throw "invalid yarn_id";
    var re = CT.re(this.re_pickyarn,{'Y':yarn_id});
    var atoms = this.weave5c.replace(re,"$2$1");
    var sorted = atoms.match(this.re_improper5).sort().join('');
    var form5c = sorted.replace(this.re_improper5,"$2$3$1");
    return form5c;
}

CT.prototype.re_white = "(.)(?:$F)|(..).";
CT.prototype.re_mark = CT.re("(. )|(..) ");
CT.prototype.re_weave3 = CT.re("$b  ((?:[^$e]..)*)$e  .*",CT.$,"m");
//CT.prototype.re_scour = CT.re("$3$Z*?$<  $Z*|($3$Z*)");
CT.prototype.re_diff = CT.re([
                        "$X  $Z*?$<  $Z*",      // old, old deleted
                        "($X ) $Z*?$<(.).$Z*",  // old, just deleted
                        "($X)  $Z*?(?:$>([^ ]).)+$<( ) $Z*", // old deleted, just recovered
                        "($X  )$Z*",            // old, no changes
                        "$X..$Z*?$<..$Z*",      // phantom (new, just deleted)
                        "($X..)$Z*"             // new, still alive
                    ].join('|'));
CT.prototype.getHili3 = function (weft2) {
    var w3 = this.getWeave3();
    var re_paint_white = CT.re(this.re_white,{'F':CT.getFiltre(weft2)});
    var spaced = w3.replace(re_paint_white,"$1$2 ");
    var marked = spaced.replace(this.re_mark,"$1$2 ");
    var weave_hili = marked.replace(this.re_diff,"$1$2"+"$3$4$5"+"$6"+"$7");
    var cut = weave_hili.match(this.re_weave3);
    return cut[1];
}

CT.prototype.addComma = function () {
    if (!this.commas) this.commas='';
    this.commas += this.getYarnLength(); // default yarn, pov
}

CT.prototype.getRevertChunk3c = function (chunk) {
    var rev_chunk3;
    if (chunk[0]=='\u0008') {
        rev_chunk3 = chunk.replace(this.re_form5c,"\u007F$2");
    } else if (chunk[0]=='\u007F') {
        // FIXME big pending issue in batch processing: awareness changes for >
        // FIXME Convention: signal awareness explicitly
        rev_chunk3 = chunk.replace(this.re_form5c,"\u0008$2");
    } else {
        rev_chunk3 = chunk.replace(this.re_form5c,"\u0008$3");
    }
    return rev_chunk3;
}

CT.prototype.re_span5c = "$5*?(.$2$B$5*.$2$E).*";
CT.prototype.re_point5c = "$5*?(.$2$B).*";
CT.prototype.re_yarn_chunk = CT.re("($<$4)+|($>$4)+|($5)+");
CT.prototype.getRevertSpan3c = function (span_int) {
    if (span_int.length!=4 || span_int[0]!=span_int[2]) throw "incorrect interval";
    var yarn5c = this.getYarn5c(span_int[0]);
    var b = span_int.substr(0,2);
    var e = span_int.substr(2,2);
    var spanre = CT.re( b==e?this.re_point5c:this.re_span5c, {'B':b,'E':e}, 'm' );
    var span = yarn5c.match(spanre);
    if (!span || !span[1]) throw "incorrect span specification";
    var chunks = span[1].match(this.re_yarn_chunk);
    var patch3c = [];
    for(var i=0; i<chunks.length; i++)
        patch3c.push (this.getRevertChunk3c(chunks[i]));
    return patch3c.join('');
}

CT.prototype.re_range = /^(.).\1.$/;
CT.prototype.rollbackChanges = function (range) {
    if (!range.match(this.re_range))
        throw "invalid range: "+range;
    var undo_patch = this.getRevertSpan3c(range);
    var patch5c = this.convertPatch3cTo5c(undo_patch,range[0]);
    this.addPatch5c(patch5c);
}


CT.selfCheck = function () {
    
    function stacktrace() { 
        function st2(f) {
            return !f ? [] :  st2(f.caller).concat
                ([f.toString().split('(')[0].substring(9) + 
                  '(' + f.arguments.join(',') + ')']);
        }
        return st2(arguments.callee.caller);
    }
    
    function testeq (must, is) {
        if (must!==is) {
            var msg = "equality test fail: must be '"+must+"' have '"+is+"'";
            log(msg);
            if (printStackTrace) {
                var stack = printStackTrace();
                stack.shift(); stack.shift(); stack.shift();
                log(stack.join('\n'));
            }
            throw msg;
        }
    }
    function log (rec) {
        if (window) {
            var p = document.createElement("pre");
            p.appendChild(document.createTextNode(rec));
            document.body.appendChild(p);
        }
    }

    var four_authors = new CTRoster
        ({'A':"Alice",'B':"Bob",'C':"Carol",'D':"Dave"});

    function testStatics () {
        testeq("1\\.2\\-3\\]",CT.escapeMeta("1.2-3]"));
        testeq("0[0-1]|A[0-\\?]|\\[[0-8]",CT.getFiltre("01A?[8"));
        testeq("0[^1-\uffff]|A[^\\?-\uffff]|\\[[^8-\uffff]",CT.getExFiltre("01A?[8"));
        testeq("01A2B3C4",CT.dryWeft2("B301B2A0C400C1A2"));
        testeq('4',CT.getYarnLength("01A2B3C4",'C'));
        var re = CT.re( "abc$De$F", {'D':'d','F':'f'} );
        testeq(1," abcdef".search(re));
        testeq(true,CT.isCover("01A2B3C0","A2B1C0"));
        testeq("0ABCD",four_authors.getSortedYarnIds()); // FIXME: 0length X
        log("statics tests OK");
    }


    function testBasicCt () {
        var test = new CT('',four_authors);
        testeq("01",test.getWeft2());
        //testeq(test.allocateYarnCode(),"A");
        testeq("",test.getText1());
        testeq(0,test.compareWeft1("01","01"));
        testeq("\u00010000\u00040001",test.getYarn5c('0'));
        // testeq(-1,test.compareWeft1("01","01A2")); TEST AS INCORR INPUT

        var v_te = test.addNewVersion("Te","Alice");
        //testeq("B",test.allocateYarnCode());
        testeq("Te",test.getText1());
        testeq("\x010000T00A0eA0A1\x040001",test.getWeave5c());
        testeq("00A0",test.getDeps4c());
        testeq(-1,test.compareWeft1("01","01A2"));
        testeq("01A1",test.getYarnAwareness("A"));

        var v_test = test.addNewVersion("Test","Alice");
        testeq("01A3",v_test);
        testeq("Test",test.getPlainText());

        var v_text = test.addNewVersion("Tekst","Bob");
        testeq("01A3B1",test.getWeft2());
        testeq("00A0A1B1A3B0",test.getDeps4c());
        testeq(1,test.compareWeft1("01A4B1","01A4"));
        testeq("01A3B1",test.getYarnAwareness("B")); // awareness decl
        testeq("01A3B1",test.closeWeft2("B1"));

        var w5c_test = test.getVersion(v_test);
        w5c_test.addNewVersion("Text","Carol");
        var p5c_tekxt = w5c_test.getTail5c(v_test);
        test.addPatch5c(p5c_tekxt);
        testeq("01A3B1C2",test.getWeft2());
        testeq("Tekxt",test.getText1());
        testeq("\u00010000T00A0eA0A1kA1B1xA1C2sA1A2\u0008A2C0tA2A3\u00040001"+
                "\u0006A3B0\u0006A3C1",test.getWeave5c());
        testeq(1,test.compareWeft1("01A4B1","01A4C2"));
        testeq("01A3B1",test.getYarnAwareness("B")); // awareness decl

        log("basic functionality tests OK");
    }

    function testBracing () {
        var braces = new CT('',four_authors);
        braces.addNewVersion("Text","Alice");
        testeq("Text",braces.getText1());
        var round = braces.addNewVersion("(Text)","Bob");
        testeq("(Text)",braces.getText1());
        braces.addNewVersion("[Text]","Carol"); // what actually happens
        testeq("[Text]",braces.getText1());
        var v = braces.getVersion(round);
        testeq("(Text)",v.getText1());
        log("bracing tests OK");
    }

    function testDiff () {
        var braces = new CT('',four_authors);
        var start = braces.addNewVersion("Text","Alice");
        var round = braces.addNewVersion("(Text)","Bob");
        braces.addNewVersion("Text","Carol");
        braces.addNewVersion("[Text]","Carol");
        testeq( "[C ( CT  e  x  t  ]C ) C", braces.getHili3(round) );
        log("basic diff OK");
    }

    function testUndo () {
        var test = new CT('',four_authors);
        var start = test.addNewVersion("Text","Alice");
        var round = test.addNewVersion("Tezzzt","Bob");
        testeq("T  e  zB zB zB x Bt  ",test.getHili3("01A3"));
        var undo_patch = test.getRevertSpan3c("B0B4");
        testeq("\u007FA2\bB1\bB2\bB3\bB4",undo_patch);
        var patch5c = test.convertPatch3cTo5c(undo_patch,"Bob");
        test.addPatch5c(patch5c);
        testeq("Text",test.getText1());
        testeq("T  e  x  t  ",test.getHili3("01A3"));
        log("undo test OK");
    }

    // Open problem in method signature reengineering: know no yarn ->
    // don't know where to put ack marks TODO
    function testComplexDiff () {
        var test = new CT('',four_authors);
        test.addNewVersion("Tex","Alice");
        test.addNewVersion("TexNt","Alice");
        test.addNewVersion("Text","Alice");
        test.addNewVersion("TextZ","Alice");
        testeq('6',test.getYarnLength("A"));
        test.rollbackChanges("A6A6","Alice"); // TODO add redo/undo

        var line = test.getWeft2();

        test.addNewVersion("Tex!","Bob");
        test.addNewVersion("LaTex!","Bob");
        test.rollbackChanges("B2B2","Bob");
        
        var hili = test.getHili3(line);
        
        testeq("LB aB T  e  x  t B",hili);
        
        log("complex diff test OK");
    }
    
    // concurrency test
    function testConcurrency () {
        var test = new CT('',four_authors);
        var base = test.addNewVersion("Test","Alice");
        testeq("Test",test.getText1());
        var fork1 = test.clone();
        var fork2 = test.clone();
        var fork3 = test.clone();
        var w1 = fork1.addNewVersion("Te3st","Dave");
        var w2 = fork2.addNewVersion("Te2st","Carol");
        var w3 = fork3.addNewVersion("Te1st","Bob");
        
        var p15 = fork1.getTail5c(base);
        var p25 = fork2.getTail5c(base);
        var p35 = fork3.getTail5c(base);
        
        test.addPatch5c(p15);
        test.addPatch5c(p25);
        test.addPatch5c(p35);
        testeq("Te123st",test.getText1());
        
        fork1.addPatch5c(p25);
        fork1.addPatch5c(p35);
        testeq("Te123st",fork1.getText1());
        
        fork2.addPatch5c(p35);
        fork2.addPatch5c(p15);
        testeq("Te123st",fork2.getText1());
        
        fork3.addPatch5c(p15);
        fork3.addPatch5c(p25);
        testeq("Te123st",fork3.getText1());
        
        log("concurrency test OK");
    }
    
    function testMultiplicationTable () {
        var pre = document.createElement("pre");
        document.body.appendChild(pre);
        var users = {'O':"grid"};
        var grid = '';
        var line = "|  |  |  |  |  |  |  |  |  |<br/>";
        for(var i=1; i<10; i++) {
            users[''+i] = '['+i+']';
            grid += line;
        }
        var ct = new CT('',users);
        ct.addNewVersion(grid,'O');
        var repos = [];
        for(var i=1; i<10; i++) {
            repos[i] = ct.clone();
        }
        var onefixlen = 5;
        var lv = String.fromCharCode( '0'.charCodeAt(0) + 9*onefixlen - 1 );
        var end_ver = "123456789".replace(/./g,"$&"+lv);
        end_ver = "01" + end_ver + 'O'+ct.getYarnLength('O');
        function advance (l) {
            var repo = repos[l];
            var ll = ''+l;
            //if (repo.getWeft2()===end_ver)
            //    return false;
            var pos = repo.getYarnLength(ll);
            var progress = pos ? (pos.charCodeAt(0)-'0'.charCodeAt(0)+1)/5 : 0;
            if (progress==9)
                return false;
            var next = progress+1;
            var offset = progress*line.length + l*3 -3 +1;
            var num = l*next;
            var ins = (num>9?'':'0') + num;
            var text =  repo.getText1().substr(0,offset) +
                        ins +
                        repo.getText1().substr(offset+2) ;
            repo.addNewVersion(text,ll);
            return true;
        }
        function pull (a,b) {
            var repoa = repos[a];
            var repob = repos[b];
            var base = CT.commonWeft2(repoa.getWeft2(),repob.getWeft2());
            var patch_b2a = repob.getTail5c(base);
            repoa.addPatch5c(patch_b2a);
        }
        
        var done = 0;
        while (done<9) {
            var a = Math.ceil(Math.random()*9);
            var b = Math.ceil(Math.random()*19);
            if (b>9)
                advance(a);
            else
                pull(a,b);
            pre.innerHTML = a+(b>9?'':" "+b)+"<br/>"+repos[a].getText1();
            done = 0;
            for(var i=1; i<=9; i++)
                if (repos[i].getWeft2()===end_ver)
                    done++;
        }
        //pre.parentNode.removeChild(pre);
        log("multiplication table test OK");
        // testeq
    }
    
    // performance test
    function testPerformance () {
        var users = 
           {'A':"Alice",
            'B':"Bob",
            'C':"Carol",
            'D':"Dave",
            'E':"Emma",
            'F':"Fred",
            'G':"George",
            'H':"Hans",
            'I':"Ivan",
            'J':"Joost",
            'K':"Kevin",
            'L':"Lindiwe",
            'M':"Matt"};
        var ct = new CT('',users);
        while (ct.weave5c.length<5000000) {
            var patches = [];
            var text = ct.getText1();
            var start = ct.getWeft2();
            for(var yarn_id in users) {
                var coin = Math.random();
                var text_new = '';
                var hilichunk = '';
                if (coin<0.8) { // add some text
                    var len = Math.round(Math.random()*20);
                    var symb = [];
                    for(var i=0; i<len; i++)
                        symb.push(String.fromCharCode(Math.random()*30+0x61));
                    var add = symb.join('');
                    var pos = Math.random() * text.length;
                    var head = text.substring(0,text.length*pos);
                    var tail = text.substring(text.length*pos,text.length);
                    text_new = head + add + tail;
                    hilichunk = add.replace(/(.)/mg,"$1"+yarn_id+" ");
                } else {
                    var len = Math.round(Math.random()*20);
                    if (len>text.length)
                        len = text.length;
                    var off = Math.random() * (text.length-len);
                    var head = text.substring(0,off);
                    var deleted = text.substring(off,off+len);
                    var tail = text.substring(off+len,text.length);
                    text_new = head + tail;
                    hilichunk = deleted.replace(/(.)/mg,"$1 "+yarn_id);
                }
                var clone = ct.clone();
                clone.addNewVersion(text_new,users[i]);
                var p5c = clone.getTail5c(start);
                patches.push(p5c);
                chunks_sorted.push(hilichunk);
            }
            while (patches.length)
                ct.addPatch5c(patches.pop());
            var hili = ct.getHili3(start);
            hili = hili.replace(/.  |(...)/mg,"$1");
            var spit = hili.match(/.(..)(.\1)* /mg);
            split.sort();
            testeq(chunks_sorted,split);
        }
    }
    
    // incorrect input tests

    testStatics();
    testBasicCt();
    testBracing();
    testDiff();
    testUndo();
    testComplexDiff();
    testConcurrency();
    testMultiplicationTable();
    //testPerformance();

}
