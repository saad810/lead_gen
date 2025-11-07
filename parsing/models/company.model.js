import { cp } from "fs";
import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
    batchID: { type: String, trim: true },
    companyName: { type: String, trim: true },
    entityType: { type: String, trim: true },
    usdDotStatus: { type: String, trim: true },
    operatingStatus: { type: String, trim: true },
    mcNumber: {
        type: String, 
        sparse: true,
        trim: true, 
        unique: true
    },
    legalName: { type: String, trim: true },
    dbaName: { type: String, trim: true },
    physicalAddress: { type: String, trim: true },
    mailingAddress: { type: String, trim: true },
    phone: { type: String, trim: true },
    mcs150Date: { type: String, trim: true },
    mcs150Mileage: { type: String, trim: true },
    powerUnits: { type: String, trim: true },
    drivers: { type: String, trim: true },

    createdAt: { type: Date, default: Date.now },
    source: { type: String, default: "safer.fmcsa.dot.gov" }
});

// companySchema.index({ mcNumber: 1 }, { unique: true, sparse: true });
// companySchema.createIndex({ mcid: 1 }, { unique: true });

const Company = mongoose.model("Company", companySchema);
export default Company;
