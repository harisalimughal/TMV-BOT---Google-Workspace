import { ScenarioFolderKey } from "../google/drive";
import {
  CHECK_IN_SIGNATURE_TEXT, CHECK_OUT_SIGNATURE_TEXT, DAMAGE_CATEGORIES, LIABILITY_REPORT_SIGNATURE_TEXT,
  PARKING_LIABILITY_NOTICE_TEXT, PARKING_LIABILITY_NOTICE_TITLE
} from "./scenario.text";

export type ScenarioKey = "checkin" | "checkout" | "parking" | "liability";
export type ScenarioFieldType = "text" | "tel" | "email" | "date" | "yesno" | "multiselect";

export interface ScenarioFieldSpec {
  /** Also the form field name and the sheet-write lookup key. */
  name: string;
  label: string;
  type: ScenarioFieldType;
  required: boolean;
  /** multiselect only. */
  options?: string[];
  /** Defaults to "Type here" (or "Tap to select" for multiselect). */
  placeholder?: string;
}

export interface ScenarioSpec {
  key: ScenarioKey;
  title: string;
  /** Shown on the intermediate "tap to open" card before the form link. */
  menuDescription: string;
  /** Verbatim legal notice shown above the fields, if any (Parking Liability only). */
  noticeHtml?: string;
  /** Heading over the notice block — distinct from `title`, which stays the page/menu title. */
  noticeTitle?: string;
  fields: ScenarioFieldSpec[];
  /**
   * Renders the photo picker immediately after this field instead of after every field
   * (the default) — Check In/Check Out need the photo step right after the container
   * number, matching the client's form order.
   */
  photoAfterField?: string;
  photoLabel: string;
  photoMin: number;
  photoMax: number;
  /** Verbatim legal/confirmation paragraph shown above the signature pad, if any. */
  signatureText?: string;
  /** Every current scenario ends with a required signature, even ones with no
   *  accompanying paragraph (Parking Liability) — kept explicit rather than inferred
   *  from signatureText so a bare signature step still renders the pad. */
  hasSignature: boolean;
  folderKey: ScenarioFolderKey;
  sheet: "StorageCheckIn" | "StorageCheckOut" | "ParkingLiability" | "LiabilityReport";
}

export const SCENARIOS: Record<ScenarioKey, ScenarioSpec> = {
  checkin: {
    key: "checkin",
    title: "Check In",
    menuDescription: "Storage check-in: container number, photo evidence, client details and signature.",
    fields: [
      { name: "container_number", label: "Container Number", type: "text", required: true },
      { name: "client_name", label: "Cliente Name", type: "text", required: true },
      { name: "client_phone", label: "Client phone", type: "tel", required: true },
      { name: "client_email", label: "Client Email", type: "email", required: true },
      { name: "client_present", label: "Is the client present ?", type: "yesno", required: true },
      { name: "date", label: "DD/MM/YY", type: "date", required: true, placeholder: "Select" }
    ],
    photoAfterField: "container_number",
    photoLabel: "Evidence that the items have been loaded.",
    photoMin: 1,
    photoMax: 1,
    signatureText: CHECK_IN_SIGNATURE_TEXT,
    hasSignature: true,
    folderKey: "CheckIn",
    sheet: "StorageCheckIn"
  },
  checkout: {
    key: "checkout",
    title: "Check Out",
    menuDescription: "Storage check-out: container number, photo evidence, client details and signature.",
    fields: [
      { name: "container_number", label: "Container Number", type: "text", required: true },
      { name: "client_name", label: "Cliente Name", type: "text", required: true },
      { name: "client_email", label: "Client Email", type: "email", required: true },
      { name: "client_present", label: "Is the client present at drop-off ?", type: "yesno", required: true },
      { name: "date", label: "DD/MM/YY", type: "date", required: true, placeholder: "Select" }
    ],
    photoAfterField: "container_number",
    photoLabel: "Evidence that the items have been loaded.",
    photoMin: 1,
    photoMax: 1,
    signatureText: CHECK_OUT_SIGNATURE_TEXT,
    hasSignature: true,
    folderKey: "CheckOut",
    sheet: "StorageCheckOut"
  },
  parking: {
    key: "parking",
    title: "Parking Liability",
    menuDescription: "Parking liability notice: address, client name, restriction photos and signature.",
    noticeHtml: PARKING_LIABILITY_NOTICE_TEXT,
    noticeTitle: PARKING_LIABILITY_NOTICE_TITLE,
    fields: [
      { name: "address", label: "Address as show on the booking ?", type: "text", required: true },
      { name: "client_name", label: "Full client name as on the booking ?", type: "text", required: true }
    ],
    photoLabel: "Parking restrictions photos",
    photoMin: 1,
    photoMax: 4,
    // No accompanying legal paragraph in the spec — just the signature field itself.
    signatureText: undefined,
    hasSignature: true,
    folderKey: "ParkingLiability",
    sheet: "ParkingLiability"
  },
  liability: {
    key: "liability",
    title: "Liability Report",
    menuDescription: "Liability for damage and accidents: damage categories, photos and signature.",
    fields: [
      {
        name: "damage_categories", label: "Damage Liability & Assembly Risk Notice", type: "multiselect",
        required: true, options: DAMAGE_CATEGORIES
      }
    ],
    photoLabel: "Pictures — Take as much as need",
    photoMin: 1,
    photoMax: 8,
    signatureText: LIABILITY_REPORT_SIGNATURE_TEXT,
    hasSignature: true,
    folderKey: "LiabilityReport",
    sheet: "LiabilityReport"
  }
};
