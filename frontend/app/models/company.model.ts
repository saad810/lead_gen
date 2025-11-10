import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICompany extends Document {
  batchID?: string;
  companyName?: string;
  entityType?: string;
  usdDotStatus?: string;
  operatingStatus?: string;
  mcNumber?: string;
  legalName?: string;
  dbaName?: string;
  physicalAddress?: string;
  mailingAddress?: string;
  phone?: string;
  mcs150Date?: string;
  mcs150Mileage?: string;
  powerUnits?: string;
  drivers?: string;
  createdAt?: Date;
  source?: string;
}

const CompanySchema = new Schema<ICompany>({
  batchID: { type: String, trim: true },
  companyName: { type: String, trim: true },
  entityType: { type: String, trim: true },
  usdDotStatus: { type: String, trim: true },
  operatingStatus: { type: String, trim: true },
  mcNumber: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
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
  source: { type: String, default: "safer.fmcsa.dot.gov" },
});

const Company: Model<ICompany> =
  mongoose.models.Company || mongoose.model<ICompany>("Company", CompanySchema);

export default Company;
