export namespace importdb {
	
	export class BibtexPreviewResult {
	    refs: models.CreateReferenceInput[];
	    duplicateCiteKeys: string[];
	
	    static createFrom(source: any = {}) {
	        return new BibtexPreviewResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.refs = this.convertValues(source["refs"], models.CreateReferenceInput);
	        this.duplicateCiteKeys = source["duplicateCiteKeys"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ImportResult {
	    imported: number;
	    skipped: number;
	
	    static createFrom(source: any = {}) {
	        return new ImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.imported = source["imported"];
	        this.skipped = source["skipped"];
	    }
	}
	export class PreviewResult {
	    duplicateCiteKeys: string[];
	    referenceCount: number;
	    tagCount: number;
	    folderCount: number;
	
	    static createFrom(source: any = {}) {
	        return new PreviewResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.duplicateCiteKeys = source["duplicateCiteKeys"];
	        this.referenceCount = source["referenceCount"];
	        this.tagCount = source["tagCount"];
	        this.folderCount = source["folderCount"];
	    }
	}

}

export namespace models {
	
	export class LinkInput {
	    label: string;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new LinkInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.url = source["url"];
	    }
	}
	export class CreateReferenceInput {
	    entryType: string;
	    citeKey: string;
	    title: string;
	    authors: string;
	    year: number;
	    venue: string;
	    volume: string;
	    number: string;
	    pages: string;
	    doi: string;
	    url: string;
	    abstract: string;
	    keywords: string;
	    notes: string;
	    tags: string[];
	    folders: string[];
	    githubUrl: string;
	    links: LinkInput[];
	    fromImport: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CreateReferenceInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entryType = source["entryType"];
	        this.citeKey = source["citeKey"];
	        this.title = source["title"];
	        this.authors = source["authors"];
	        this.year = source["year"];
	        this.venue = source["venue"];
	        this.volume = source["volume"];
	        this.number = source["number"];
	        this.pages = source["pages"];
	        this.doi = source["doi"];
	        this.url = source["url"];
	        this.abstract = source["abstract"];
	        this.keywords = source["keywords"];
	        this.notes = source["notes"];
	        this.tags = source["tags"];
	        this.folders = source["folders"];
	        this.githubUrl = source["githubUrl"];
	        this.links = this.convertValues(source["links"], LinkInput);
	        this.fromImport = source["fromImport"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Folder {
	    id: string;
	    name: string;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Folder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ReferenceLink {
	    id: string;
	    referenceId: string;
	    label: string;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new ReferenceLink(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.referenceId = source["referenceId"];
	        this.label = source["label"];
	        this.url = source["url"];
	    }
	}
	export class Tag {
	    id: string;
	    name: string;
	    color: string;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Tag(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Reference {
	    id: string;
	    entryType: string;
	    citeKey: string;
	    title: string;
	    authors: string;
	    year: number;
	    venue: string;
	    volume: string;
	    number: string;
	    pages: string;
	    doi: string;
	    url: string;
	    abstract: string;
	    keywords: string;
	    notes: string;
	    rawBibtex: string;
	    githubUrl: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	    // Go type: time
	    importedAt?: any;
	    tags: Tag[];
	    folders: Folder[];
	    links: ReferenceLink[];
	
	    static createFrom(source: any = {}) {
	        return new Reference(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.entryType = source["entryType"];
	        this.citeKey = source["citeKey"];
	        this.title = source["title"];
	        this.authors = source["authors"];
	        this.year = source["year"];
	        this.venue = source["venue"];
	        this.volume = source["volume"];
	        this.number = source["number"];
	        this.pages = source["pages"];
	        this.doi = source["doi"];
	        this.url = source["url"];
	        this.abstract = source["abstract"];
	        this.keywords = source["keywords"];
	        this.notes = source["notes"];
	        this.rawBibtex = source["rawBibtex"];
	        this.githubUrl = source["githubUrl"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	        this.importedAt = this.convertValues(source["importedAt"], null);
	        this.tags = this.convertValues(source["tags"], Tag);
	        this.folders = this.convertValues(source["folders"], Folder);
	        this.links = this.convertValues(source["links"], ReferenceLink);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class UpdateReferenceInput {
	    id: string;
	    entryType: string;
	    citeKey: string;
	    title: string;
	    authors: string;
	    year: number;
	    venue: string;
	    volume: string;
	    number: string;
	    pages: string;
	    doi: string;
	    url: string;
	    abstract: string;
	    keywords: string;
	    notes: string;
	    tags: string[];
	    folders: string[];
	    githubUrl: string;
	    links: LinkInput[];
	
	    static createFrom(source: any = {}) {
	        return new UpdateReferenceInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.entryType = source["entryType"];
	        this.citeKey = source["citeKey"];
	        this.title = source["title"];
	        this.authors = source["authors"];
	        this.year = source["year"];
	        this.venue = source["venue"];
	        this.volume = source["volume"];
	        this.number = source["number"];
	        this.pages = source["pages"];
	        this.doi = source["doi"];
	        this.url = source["url"];
	        this.abstract = source["abstract"];
	        this.keywords = source["keywords"];
	        this.notes = source["notes"];
	        this.tags = source["tags"];
	        this.folders = source["folders"];
	        this.githubUrl = source["githubUrl"];
	        this.links = this.convertValues(source["links"], LinkInput);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

