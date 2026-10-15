import { Pill, Heart, Eye, Baby, Leaf, Shield, Brain, Stethoscope, Droplets, Wind, Syringe, Thermometer, CircleDot, Tablets, Bandage, FlaskConical, Activity, Package } from "lucide-react";

export interface MedicineCategory {
  id: string;
  nameKey: string;
  icon: any;
}

/** Canonical slug: lowercase + trim, so "Cardiovascular" and "cardiovascular" match. */
export function canonicalCategory(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** Display label for any raw DB category value (covers live variants). */
const LABELS: Record<string, string> = {
  analgesic: "Analgesic",
  analgesic_antipyretic: "Analgesic / Antipyretic",
  antacid: "Antacid",
  antibiotic: "Antibiotic",
  antimicrobial: "Antimicrobial",
  antidiabetic: "Antidiabetic",
  diabetes: "Diabetes Care",
  cardiovascular: "Cardiovascular",
  dermatology: "Dermatology",
  eye_ent: "Eye / ENT",
  eye: "Eye / ENT",
  vitamins: "Vitamins & Supplements",
  vitamins_minerals: "Vitamins & Minerals",
  "vitamins & supplements": "Vitamins & Supplements",
  respiratory: "Respiratory",
  gastrointestinal: "Gastrointestinal",
  neurological: "Neurological",
  hormonal: "Hormonal",
  antimalarial: "Anti-malarial",
  antiseptic: "Antiseptic",
  antifungal: "Antifungal",
  antiparasitic: "Antiparasitic",
  pediatric: "Pediatric",
  herbal: "Herbal / Unani",
  service: "Services",
  miscellaneous: "Miscellaneous",
  uncategorized: "Uncategorized",
  "medical devices": "Medical Devices",
  "baby & mother": "Baby & Mother",
  "bone & muscle": "Bone & Muscle",
};

export function categoryLabel(raw: unknown): string {
  const c = canonicalCategory(raw);
  if (!c) return "Uncategorized";
  return LABELS[c] ?? String(raw).trim();
}

export const categories: MedicineCategory[] = [
  { id: "analgesic", nameKey: "cat_analgesic", icon: Thermometer },
  { id: "antacid", nameKey: "cat_antacid", icon: Tablets },
  { id: "antibiotic", nameKey: "cat_antibiotic", icon: Syringe },
  { id: "antimicrobial", nameKey: "cat_antibiotic", icon: Syringe },
  { id: "antidiabetic", nameKey: "cat_antidiabetic", icon: Droplets },
  { id: "cardiovascular", nameKey: "cat_cardiovascular", icon: Heart },
  { id: "dermatology", nameKey: "cat_dermatology", icon: Bandage },
  { id: "eye_ent", nameKey: "cat_eye_ent", icon: Eye },
  { id: "vitamins", nameKey: "cat_vitamins", icon: FlaskConical },
  { id: "respiratory", nameKey: "cat_respiratory", icon: Wind },
  { id: "gastrointestinal", nameKey: "cat_gastrointestinal", icon: CircleDot },
  { id: "neurological", nameKey: "cat_neurological", icon: Brain },
  { id: "hormonal", nameKey: "cat_hormonal", icon: Stethoscope },
  { id: "antimalarial", nameKey: "cat_antimalarial", icon: Shield },
  { id: "antiseptic", nameKey: "cat_antiseptic", icon: Droplets },
  { id: "pediatric", nameKey: "cat_pediatric", icon: Baby },
  { id: "herbal", nameKey: "cat_herbal", icon: Leaf },
  { id: "service", nameKey: "cat_service", icon: Activity },
  { id: "uncategorized", nameKey: "cat_all", icon: Package },
];

export { Pill };
