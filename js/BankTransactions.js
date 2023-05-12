import wixSecretsBackend from 'wix-secrets-backend';
import { getDateF, getSubCoursesData, logErr, updLastOrdNum, insBankTransactions, getBankMovements, updBankMovements } from 'backend/courses/datasql.jsw';
import { invoice_creVat } from 'backend/courses/invoice.jsw';
import {fetch} from 'wix-fetch';

const moduleBankTransactions = 'backend/courses/BankTransactions.';

export class BankTransactions {
    
    // fetch data from bank API
    async fetchData(nameAPI, dateFrom, dateTo) {

        /*
        const moduleName = import.meta.url.split('/').pop();
        const myElement = document.getElementById('body');
        myElement.setAttribute('data-module', moduleName);
        */

        const moduleName = moduleBankTransactions + 'fetchData()';

        /*
        Struktura: https://www.fio.cz/ib_api/rest/periods/{token}/{datum od}/{datum do}/transactions.{format}
        token: unikátní vygenerovaný token
        datum od: datum - začátek stahovaných příkazů ve formátu rok-měsíc-den (rrrr-mm-dd)
        datum do: datum - konec stahovaných příkazů ve formátu rok-měsíc-den (rrrr-mm-dd)
        format: formát pohybů
        Příklad: Získání pohybů v období od 25.8.2012 do 31.8.2012 v xml
        https://www.fio.cz/ib_api/rest/periods/${keyAPI}/2012-08-25/2012-08-31/transactions.xml
        */

        const keyAPI = await wixSecretsBackend.getSecret(nameAPI); // Fio_IvetaHavlova_API_Key (OSVC) or Fio_Planeta501_API_Key (s.r.o.)

        let URL= 'https://www.fio.cz/ib_api/rest/periods/' + keyAPI + '/' + dateFrom + '/' + dateTo + '/transactions.json'; // načtení pohybů - GET

        // GET bank transactions
        return fetch(URL, {"method": "get"})
        .then( (httpResponse) => {
            if (httpResponse.ok) {
            return httpResponse.json()
            } else {
            return Promise.reject("Fetch did not succeed");
            }
        } )
        .then(data => {
            console.log(data);
            return data;
            }
        ).catch(err => logErr(moduleName, err));
    
    } // END BankTransactions.fetchData()

    // insert fetch bank data into eshop_bankTransactions collection
    async saveData(nameAPI, dateFrom, dateTo, state) {

        const moduleName = moduleBankTransactions + 'saveData()';

        let cntSavedItems = 0;

        let bankTransactionData = await this.fetchData(nameAPI, dateFrom, dateTo);

        // get number of transactions
        let baseData = bankTransactionData["accountStatement"]["transactionList"]["transaction"];   // base for json path
        let cntRows = baseData.length;
        console.log(`numRows backEnd (${moduleName}): ${cntRows}`);

        try {

        // loop bank transactions
        for (let rowNum = 0; rowNum < cntRows; rowNum++) {
            let stav = state;
            let baseDataCycle = baseData[rowNum];
            let idPohybu = baseDataCycle["column22"]["value"];
            let datum = baseDataCycle["column0"]["value"];
            let datumC = new Date(datum.date);
            let objem = baseDataCycle["column1"]["value"];
            let mena = baseDataCycle["column14"]["value"];
            let nazevProtiuctu = baseDataCycle["column10"]["value"];
            let vs = baseDataCycle["column5"]?.["value"] || '';
            let zpravaProPrijemce = baseDataCycle["column16"]?.["value"] || '';
            console.log(`rowNum backEnd (${moduleName}): ${rowNum}`);
            console.log(`idPohybu backEnd (${moduleName}): ${idPohybu}`);
            console.log(`datum backEnd (${moduleName}): ${datum}`);
            console.log(`datum converted backEnd (${moduleName}): ${datumC}`);
            console.log(`objem backEnd (${moduleName}): ${objem}`);
            console.log(`mena backEnd (${moduleName}): ${mena}`);
            console.log(`vs backEnd (${moduleName}): ${vs}`);
            console.log(`nazevProtiuctu backEnd (${moduleName}): ${nazevProtiuctu}`);
            console.log(`zpravaProPrijemce backEnd (${moduleName}): ${zpravaProPrijemce}`);
            /*
            insBankTransactions(idPohybu, datum, objem, mena, protiucet, nazevProtiuctu, kodBanky, nazevBanky, ks, vs, ss,
                                uzivatelskaIdentifikace, zpravaProPrijemce, typ, provedl, upresneni, komentar, bic, idPokynu, stav);
            */
            insBankTransactions(idPohybu, datum, objem, mena, nazevProtiuctu, vs, zpravaProPrijemce, stav);
        }
        return cntSavedItems;

        } catch(err) {logErr(moduleName, err)}

    } // END saveData()

    
    // match payments with orders
    async matchPayments(courseID, prefix, comm, dept) {

        const moduleName = moduleBankTransactions + 'matchPayments()';
        
        // get new bank movements rows
        let bankMovements = await getBankMovements('loaded');
        let cntRows = bankMovements.length; // count of bank movements rows in the state 'loaded' and with filled VS
        let cntCreatedInvoices = 0; // count of created Invoices
        console.log('cntRows: ' + cntRows);

        try {

        // create invoices when matched according to VS
        for (const j in bankMovements) {
            const element = bankMovements[j];
            let idPohybu = element['idPohybu'];
            let vs = element['vs'];
            let datum = element['datum']
            datum = datum.substring(0, 10); // trim time
            console.log('datum: ' + datum);
            let resCreInvoice = await invoice_creVat(courseID, prefix, vs, comm, dept, datum) // create Invoice
            if (resCreInvoice) {
                await updBankMovements(idPohybu, 'VS matched'); // update as matched in eshop_bankTransactions
                cntCreatedInvoices++;
            }
        }

        // mark not matched loaded bank movements as not matched ( VS not found )
        await updBankMovements('loaded', 'VS not matched');

        console.log('cntCreatedInvoices: ' + cntCreatedInvoices);
        return cntCreatedInvoices;

        } catch(err) {logErr(moduleName, err)}

    } // END matchPayments()
} // END BankTransactions