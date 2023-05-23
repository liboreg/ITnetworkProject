import wixSecretsBackend from 'wix-secrets-backend';
import { getDateF, getSubCoursesData, logErr, updLastOrdNum } from 'backend/courses/datasql.jsw';
import {fetch} from 'wix-fetch';

const moduleInvoice = 'backend/courses/Invoice.';

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class Invoice {

    async create(typ, jmeno, prijmeni, email, produkt, cena, comment, ulice, mesto, psc, zeme, firma, dic, ic, dept, status, vs, oid, i_sell_date) {

    const moduleName = moduleInvoice + 'create()';

    console.log(moduleName);
    //console.log('status: ' + status);

    // typ - estimate = Order, vat = Invoice
    
    //let comment = "Po provedení úhrady objednávky Vám bude zaslána zúčtovací faktura.\\r\\n\\r\\nCena zahrnuje přístup do Studentského portálu online na 2 roky.";    // estimate
    //let comment = "Cena zahrnuje přístup do Studentského portálu online na 2 roky.";  // vat

    const bitFAPIKey = await wixSecretsBackend.getSecret("BitFaktura"); // read BitFaktura API key from Wix Secret manager
    const URL = 'https://planeta501.bitfaktura.cz/invoices.json';
    const today = 0; // for getDateF();
    const payment_days = 3; // 3 days payment date for Order (estimate)
    
    let buyer_name;
    if (firma) {
        buyer_name = firma;
    } else buyer_name = jmeno + ' ' + prijmeni;

    let sell_date, payment_to, payment_to_kind;
    if (typ == 'vat') {     // Invoice(vat)
        vs = '"' + vs + '"';
        oid = '"' + oid + '"';
        sell_date = i_sell_date;
        payment_to_kind = '"off"';  // don't display payment date in case of Invoice(vat)
        payment_to = '""';
    } else {    // Order(estimate)
        vs = 'null';
        oid = 'null';
        sell_date = getDateF(today);
        payment_to_kind = '"other_date"';
        payment_to = '"' + getDateF(payment_days) + '"';
    }

    let i_body = '{"api_token":"' + bitFAPIKey + '", "invoice":' +
    '{"kind": "' + typ + '","number": null,"sell_date": "' + sell_date + '","issue_date": "' + getDateF(today) +
    '","payment_to_kind":' + payment_to_kind + ',"payment_to": ' + payment_to + ',' +
    '"custom_payment_reference_number":' + vs + ',' + '"oid":' + oid + ',' + 
    '"department_id":"' + dept + '",' + //1038023 - Planeta501 s.r.o. dept, 1127923 - OSVC dept
    '"buyer_name":"' + buyer_name +
    '","buyer_street":"' + ulice + '","buyer_city": "' + mesto + '","buyer_post_code": "' + psc + '",' +
    '"buyer_country":"' + zeme + '",' + // https://www.iban.com/country-codes
    '"buyer_email":"' + email + '",' + 
    '"buyer_tax_no":"' + dic + '",' + '"buyer_register_number":"' + ic + '",' + 
    '"description":"' + comment + '",' +
    '"status":"' + status + '",' +  // 'issued' for Order(estimate) and 'paid' for Invoice(vat)
    '"positions":[';
    i_body += ' {"name":"' + produkt + '", "tax":"disabled", "total_price_gross":' + cena + ', "quantity":1}';
    i_body += ' ]}}';

    console.log('i_body: ' + i_body);

    return await fetch(URL, {
    body: i_body,
    headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
    },
    method: "POST"
    })
    .then( (httpResponse) => {
        if (httpResponse.ok) {
        return httpResponse.json()
        } else {
            let err = 'Fetch did not succeed';
            logErr(moduleName, err);
            return Promise.reject(err);
        }
    } )
    .then(data => {
        console.log(data);
        console.log("Cislo dokladu: " + data["number"]);
        console.log("view_url: " + data["view_url"]);
        let docNum = data["number"];
        //console.log('create: ordID: ' + docNum + ', ' + 'email: ' + email);
        if (docNum)
            return {"docNum":docNum, "email":email};
        else return false; 
        //return {"docNum":"O2023099","email":"liboreg@gmail.com"};
        //return 999;
        }
        )
    .catch(err => logErr(moduleName, err));

    } // END create

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Loop Order/Invoice records in subCourses form
    async createLoop(v_subCoursesData, typ, dept, status, vs, prefix, i_sell_date, comm) {

        const moduleName = moduleInvoice + 'createLoop()';

        try {
            let res;
            for (const j in v_subCoursesData) {
                const element = v_subCoursesData[j];
                console.log("element " + j + ": " + element["email"]);
                let res = await this.create(typ, element["jmeno"], element["prijmeni"], element["email"],
                    element["nazevNaFakture"], element["cena"], comm, element["ulice"], element["mesto"], element["psc"], element["zeme"],
                    element["firma"], element["dic"], element["ic"], dept, status, vs, prefix + vs, i_sell_date)

                console.log(`XXX: docnum: ${res["docNum"]}, email: ${res["email"]}`)

                if (typ == 'estimate') {
                    // Update lastOrdNum in subCourses
                    if (res["docNum"] && res["email"]) {
                        await updLastOrdNum(element["courseID"], res["docNum"], res["email"]);
                        console.log(`lastOrdNum ${res["docNum"]} of ${res["email"]} updated in subCourses collection.`);
                    } else console.log('Error in Invoice.creEstimate: updating lastOrdNum in subCourses collection.');
                } else {  // if vat (Invoice)
                    // await updCisObj(docNum)
                }

            }
            return res;
        }
        catch(err) {
            logErr(moduleName, err);
            return false;
        }
    } // END createLoop

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // create Order
    async creEstimate(courseID, approvedOrders, comm, dept) { 

    const moduleName = moduleInvoice + 'creEstimate()';

    // get data from subCourses form
    const v_subCoursesData = await getSubCoursesData(courseID, 'ALL', approvedOrders);

    const typ = 'estimate';    // Order
    const status = 'issued';
    const vs = 'null';   // no VS for Order - created and returned by BitFaktura
    const prefix = '';  // no prefix for Order
    const i_sell_date = undefined;    // no day of payment (Order)

    // create Orders via ButFaktura API
    try {
        let result = await this.createLoop(v_subCoursesData, typ, dept, status, vs, prefix, i_sell_date, comm);
        return result;
    } catch(err) {logErr(moduleName, err)}


    } //END creEstimate

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // create Invoice
    // ToDo: upd ciObj and del lastOrdNum
    async creVat(courseID, prefix, vs, comm, dept, i_sell_date) { // create Invoice

    const moduleName = moduleInvoice + 'creVat()';

    // get data from subCourses form
    const v_subCoursesData = await getSubCoursesData(courseID, prefix, vs);

    const typ = 'vat';    // Invoice
    const status = 'paid';

    try {
        // create Invoices via ButFaktura API
        let docNum = this.createLoop(v_subCoursesData, typ, dept, status, vs, prefix, i_sell_date, comm);
        if (docNum) {
            //let result = await updCisObj(docNum);
            console.log('ciObj updated and lastOrdNum deleted in subCourses collection.');
            return true
        } else {
            console.log('Error in Invoice.crevat: updating ciObj and deleting lastOrdNum in subCourses collection.');
            return false
        }
    } catch(err) {logErr(moduleName, err)}

    } // END creVat

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    } // END Invoice

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
