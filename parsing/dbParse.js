import connectDB from "./config/db.js";
import Company from "./models/company.model.js";

function getAdresses(addr) {
    const match = addr.match(/([A-Za-z\s]+),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);

    if (match) {
        return {
            city: match[1].trim(),
            state: match[2],
            zip: match[3],
        };
    }

    return { city: null, state: null, zip: null };
}

async function main() {
    try {
        const companies = await Company.find({}, { physicalAddress: 1, mailingAddress: 1, _id: 0 }).limit(10);
        console.log(companies.length);
        console.log(getAdresses(companies[0].physicalAddress));
        console.log(getAdresses(companies[0].mailingAddress));
        // const physicalAddresses = ;
    } catch (error) {
        console.error("Error fetching companies:", error);
    }
}

connectDB().then(async () => {
    await main();
});