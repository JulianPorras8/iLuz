export namespace main {
	
	export class CashShift {
	    id: number;
	    openedAt: string;
	    closedAt?: string;
	    initialCash: number;
	    expectedCash: number;
	    actualCash?: number;
	    unrecordedSalesAdjust: number;
	    status: string;
	    notes: string;
	    deviceId?: string;
	
	    static createFrom(source: any = {}) {
	        return new CashShift(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.openedAt = source["openedAt"];
	        this.closedAt = source["closedAt"];
	        this.initialCash = source["initialCash"];
	        this.expectedCash = source["expectedCash"];
	        this.actualCash = source["actualCash"];
	        this.unrecordedSalesAdjust = source["unrecordedSalesAdjust"];
	        this.status = source["status"];
	        this.notes = source["notes"];
	        this.deviceId = source["deviceId"];
	    }
	}
	export class CreditAccount {
	    id: number;
	    customerName: string;
	    phone: string;
	    creditLimit: number;
	    currentDebt: number;
	    active: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CreditAccount(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.customerName = source["customerName"];
	        this.phone = source["phone"];
	        this.creditLimit = source["creditLimit"];
	        this.currentDebt = source["currentDebt"];
	        this.active = source["active"];
	        this.createdAt = source["createdAt"];
	    }
	}
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
	    costPrice: number;
	    price: number;
	    stock: number;
	    weight: number;
	    size: string;
	    unitOfMeasure: string;
	    color: string;
	    location: string;
	    active: boolean;
	    isQuickAccess: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Product(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.barcode = source["barcode"];
	        this.name = source["name"];
	        this.costPrice = source["costPrice"];
	        this.price = source["price"];
	        this.stock = source["stock"];
	        this.weight = source["weight"];
	        this.size = source["size"];
	        this.unitOfMeasure = source["unitOfMeasure"];
	        this.color = source["color"];
	        this.location = source["location"];
	        this.active = source["active"];
	        this.isQuickAccess = source["isQuickAccess"];
	    }
	}
	export class PurchaseItem {
	    id: number;
	    purchaseId: number;
	    productId: number;
	    barcode: string;
	    productName: string;
	    qty: number;
	    unitCost: number;
	    subtotal: number;
	    suggestedPrice: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PurchaseItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.purchaseId = source["purchaseId"];
	        this.productId = source["productId"];
	        this.barcode = source["barcode"];
	        this.productName = source["productName"];
	        this.qty = source["qty"];
	        this.unitCost = source["unitCost"];
	        this.subtotal = source["subtotal"];
	        this.suggestedPrice = source["suggestedPrice"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class Purchase {
	    id: number;
	    supplierId: number;
	    supplierName: string;
	    invoiceNumber: string;
	    invoiceDate: string;
	    paymentStatus: string;
	    totalCost: number;
	    attachmentPath: string;
	    status: string;
	    notes: string;
	    createdAt: string;
	    completedAt?: string;
	    items: PurchaseItem[];
	
	    static createFrom(source: any = {}) {
	        return new Purchase(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.supplierId = source["supplierId"];
	        this.supplierName = source["supplierName"];
	        this.invoiceNumber = source["invoiceNumber"];
	        this.invoiceDate = source["invoiceDate"];
	        this.paymentStatus = source["paymentStatus"];
	        this.totalCost = source["totalCost"];
	        this.attachmentPath = source["attachmentPath"];
	        this.status = source["status"];
	        this.notes = source["notes"];
	        this.createdAt = source["createdAt"];
	        this.completedAt = source["completedAt"];
	        this.items = this.convertValues(source["items"], PurchaseItem);
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
	export class PurchaseItemInput {
	    productId: number;
	    barcode: string;
	    productName: string;
	    qty: number;
	    unitCost: number;
	    suggestedPrice: number;
	
	    static createFrom(source: any = {}) {
	        return new PurchaseItemInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.productId = source["productId"];
	        this.barcode = source["barcode"];
	        this.productName = source["productName"];
	        this.qty = source["qty"];
	        this.unitCost = source["unitCost"];
	        this.suggestedPrice = source["suggestedPrice"];
	    }
	}
	export class PurchaseInput {
	    supplierId: number;
	    invoiceNumber: string;
	    invoiceDate: string;
	    paymentStatus: string;
	    totalCost: number;
	    attachmentPath: string;
	    notes: string;
	    items: PurchaseItemInput[];
	
	    static createFrom(source: any = {}) {
	        return new PurchaseInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.supplierId = source["supplierId"];
	        this.invoiceNumber = source["invoiceNumber"];
	        this.invoiceDate = source["invoiceDate"];
	        this.paymentStatus = source["paymentStatus"];
	        this.totalCost = source["totalCost"];
	        this.attachmentPath = source["attachmentPath"];
	        this.notes = source["notes"];
	        this.items = this.convertValues(source["items"], PurchaseItemInput);
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
	
	
	export class ReportSummary {
	    period: string;
	    totalSales: number;
	    totalPurchases: number;
	    grossMargin: number;
	    grossMarginPct: number;
	    salesCount: number;
	    purchasesCount: number;
	    averageTicket: number;
	    dianUvtThreshold: number;
	    dianCurrentPct: number;
	
	    static createFrom(source: any = {}) {
	        return new ReportSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.period = source["period"];
	        this.totalSales = source["totalSales"];
	        this.totalPurchases = source["totalPurchases"];
	        this.grossMargin = source["grossMargin"];
	        this.grossMarginPct = source["grossMarginPct"];
	        this.salesCount = source["salesCount"];
	        this.purchasesCount = source["purchasesCount"];
	        this.averageTicket = source["averageTicket"];
	        this.dianUvtThreshold = source["dianUvtThreshold"];
	        this.dianCurrentPct = source["dianCurrentPct"];
	    }
	}
	export class SaleItem {
	    id: number;
	    saleId: number;
	    productId: number;
	    barcode: string;
	    productName: string;
	    qty: number;
	    unitPrice: number;
	    costPrice: number;
	    subtotal: number;
	
	    static createFrom(source: any = {}) {
	        return new SaleItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.saleId = source["saleId"];
	        this.productId = source["productId"];
	        this.barcode = source["barcode"];
	        this.productName = source["productName"];
	        this.qty = source["qty"];
	        this.unitPrice = source["unitPrice"];
	        this.costPrice = source["costPrice"];
	        this.subtotal = source["subtotal"];
	    }
	}
	export class Sale {
	    id: number;
	    ticketNumber: string;
	    totalAmount: number;
	    paymentMethod: string;
	    amountPaid: number;
	    changeDue: number;
	    customerName: string;
	    notes: string;
	    deviceId?: string;
	    createdAt: string;
	    items: SaleItem[];
	
	    static createFrom(source: any = {}) {
	        return new Sale(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.ticketNumber = source["ticketNumber"];
	        this.totalAmount = source["totalAmount"];
	        this.paymentMethod = source["paymentMethod"];
	        this.amountPaid = source["amountPaid"];
	        this.changeDue = source["changeDue"];
	        this.customerName = source["customerName"];
	        this.notes = source["notes"];
	        this.deviceId = source["deviceId"];
	        this.createdAt = source["createdAt"];
	        this.items = this.convertValues(source["items"], SaleItem);
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
	export class SaleItemInput {
	    productId: number;
	    qty: number;
	
	    static createFrom(source: any = {}) {
	        return new SaleItemInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.productId = source["productId"];
	        this.qty = source["qty"];
	    }
	}
	export class SaleInput {
	    paymentMethod: string;
	    amountPaid: number;
	    customerName: string;
	    notes: string;
	    items: SaleItemInput[];
	
	    static createFrom(source: any = {}) {
	        return new SaleInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.paymentMethod = source["paymentMethod"];
	        this.amountPaid = source["amountPaid"];
	        this.customerName = source["customerName"];
	        this.notes = source["notes"];
	        this.items = this.convertValues(source["items"], SaleItemInput);
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
	export class ShelfLevel {
	    level: number;
	    name: string;
	    slots: number;
	
	    static createFrom(source: any = {}) {
	        return new ShelfLevel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.level = source["level"];
	        this.name = source["name"];
	        this.slots = source["slots"];
	    }
	}
	export class Shelf {
	    id: number;
	    code: string;
	    name: string;
	    description: string;
	    levels: ShelfLevel[];
	    levelsJson?: string;
	    createdAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new Shelf(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.code = source["code"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.levels = this.convertValues(source["levels"], ShelfLevel);
	        this.levelsJson = source["levelsJson"];
	        this.createdAt = source["createdAt"];
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
	
	export class StoreConfig {
	    id: number;
	    storeName: string;
	    ownerName: string;
	    nitOrCedula: string;
	    address: string;
	    phone: string;
	    receiptFooter: string;
	    allowNegativeStock: boolean;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new StoreConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.storeName = source["storeName"];
	        this.ownerName = source["ownerName"];
	        this.nitOrCedula = source["nitOrCedula"];
	        this.address = source["address"];
	        this.phone = source["phone"];
	        this.receiptFooter = source["receiptFooter"];
	        this.allowNegativeStock = source["allowNegativeStock"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class Supplier {
	    id: number;
	    nitOrCedula: string;
	    name: string;
	    contactName: string;
	    phone: string;
	    email: string;
	    address: string;
	    city: string;
	    paymentTerms: string;
	    deliveryDays: string;
	    notes: string;
	    active: boolean;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Supplier(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.nitOrCedula = source["nitOrCedula"];
	        this.name = source["name"];
	        this.contactName = source["contactName"];
	        this.phone = source["phone"];
	        this.email = source["email"];
	        this.address = source["address"];
	        this.city = source["city"];
	        this.paymentTerms = source["paymentTerms"];
	        this.deliveryDays = source["deliveryDays"];
	        this.notes = source["notes"];
	        this.active = source["active"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}

}

