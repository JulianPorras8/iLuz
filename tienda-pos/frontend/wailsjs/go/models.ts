export namespace main {
	
	export class InventorySession {
	    id: number;
	    name: string;
	    responsible: string;
	    scope: string;
	    notes: string;
	    status: string;
	    startedAt: string;
	    closedAt?: string;
	    totalItems?: number;
	    countedItems?: number;
	
	    static createFrom(source: any = {}) {
	        return new InventorySession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.responsible = source["responsible"];
	        this.scope = source["scope"];
	        this.notes = source["notes"];
	        this.status = source["status"];
	        this.startedAt = source["startedAt"];
	        this.closedAt = source["closedAt"];
	        this.totalItems = source["totalItems"];
	        this.countedItems = source["countedItems"];
	    }
	}
	export class InventorySessionItem {
	    id: number;
	    sessionId: number;
	    productId: number;
	    barcode: string;
	    productName: string;
	    location: string;
	    unitPrice: number;
	    systemStockAtStart: number;
	    countedQty: number;
	    isCounted: boolean;
	    lastCountedAt?: string;
	    adjustmentApplied: boolean;
	    stockAfter?: number;
	    notes: string;
	    variance: number;
	    difference: number;
	    breakdown?: string;
	
	    static createFrom(source: any = {}) {
	        return new InventorySessionItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sessionId = source["sessionId"];
	        this.productId = source["productId"];
	        this.barcode = source["barcode"];
	        this.productName = source["productName"];
	        this.location = source["location"];
	        this.unitPrice = source["unitPrice"];
	        this.systemStockAtStart = source["systemStockAtStart"];
	        this.countedQty = source["countedQty"];
	        this.isCounted = source["isCounted"];
	        this.lastCountedAt = source["lastCountedAt"];
	        this.adjustmentApplied = source["adjustmentApplied"];
	        this.stockAfter = source["stockAfter"];
	        this.notes = source["notes"];
	        this.variance = source["variance"];
	        this.difference = source["difference"];
	        this.breakdown = source["breakdown"];
	    }
	}
	export class Location {
	    id: number;
	    code: string;
	    name: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new Location(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.code = source["code"];
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}
	export class Product {
	    id: number;
	    barcode: string;
	    name: string;
	    price: number;
	    stock: number;
	    weight: number;
	    size: string;
	    unitOfMeasure: string;
	    color: string;
	    location: string;
	    active: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Product(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.barcode = source["barcode"];
	        this.name = source["name"];
	        this.price = source["price"];
	        this.stock = source["stock"];
	        this.weight = source["weight"];
	        this.size = source["size"];
	        this.unitOfMeasure = source["unitOfMeasure"];
	        this.color = source["color"];
	        this.location = source["location"];
	        this.active = source["active"];
	    }
	}
	export class ScanPayload {
	    found: boolean;
	    barcode: string;
	    product?: Product;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new ScanPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.found = source["found"];
	        this.barcode = source["barcode"];
	        this.product = this.convertValues(source["product"], Product);
	        this.message = source["message"];
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
	export class ScannerStatusPayload {
	    connected: boolean;
	    port: string;
	    error?: string;
	    availablePorts: string[];
	
	    static createFrom(source: any = {}) {
	        return new ScannerStatusPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.port = source["port"];
	        this.error = source["error"];
	        this.availablePorts = source["availablePorts"];
	    }
	}

}

