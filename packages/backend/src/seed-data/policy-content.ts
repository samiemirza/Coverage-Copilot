/**
 * Synthetic policy content for the MVP demo business, "Jane's Kitchen"
 * (build-spec §3: "one sample business + 2-3 sample/synthetic policy PDFs").
 * Deliberately includes real coverage gaps (no liquor liability, no
 * flood/earthquake) so Milestone 4's gap-detection has genuine signal to
 * find against a baseline table, not a strawman.
 */

export interface PolicySection {
  number: string;
  heading: string;
  body: string;
}

export interface PolicyContent {
  key: string;
  filename: string;
  title: string;
  sections: PolicySection[];
}

export const policies: PolicyContent[] = [
  {
    key: "general-liability",
    filename: "general-liability-policy.pdf",
    title: "Commercial General Liability Policy — Jane's Kitchen LLC",
    sections: [
      {
        number: "1",
        heading: "Declarations",
        body: "Named Insured: Jane's Kitchen LLC. Business Description: Full-service restaurant, 20 employees. Policy Period: 12 months from the effective date shown on the coverage summary. Per-Occurrence Limit: $1,000,000. General Aggregate Limit: $2,000,000.",
      },
      {
        number: "2",
        heading: "Definitions",
        body: "\"Bodily injury\" means physical injury, sickness, or disease sustained by a person, including resulting death. \"Property damage\" means physical injury to tangible property, including resulting loss of use. \"Premises\" means the location listed in the Declarations and its immediately surrounding areas the insured owns or rents for business use.",
      },
      {
        number: "3",
        heading: "Insuring Agreement",
        body: "We will pay those sums the insured becomes legally obligated to pay as damages because of bodily injury or property damage to which this insurance applies, caused by an occurrence during the policy period, subject to the limits, conditions, and exclusions of this policy.",
      },
      {
        number: "4.1",
        heading: "Premises and Operations Liability",
        body: "This policy covers bodily injury or property damage arising out of the ownership, maintenance, or use of the insured premises, and out of the insured's business operations conducted on or away from the premises, subject to the limits shown in the Declarations.",
      },
      {
        number: "4.2",
        heading: "Bodily Injury to Customers",
        body: "This policy covers bodily injury liability arising from a customer's slip, trip, or fall while on the insured premises during business hours, up to the per-occurrence limit shown in the Declarations. This includes injuries occurring in dining areas, restrooms, and building entrances maintained by the insured.",
      },
      {
        number: "4.3",
        heading: "Property Damage Liability",
        body: "This policy covers damage the insured's operations cause to property belonging to others, such as a customer's vehicle damaged by a falling sign, up to the per-occurrence limit shown in the Declarations.",
      },
      {
        number: "5.1",
        heading: "Liquor Liability Exclusion",
        body: "This policy does NOT cover bodily injury or property damage arising out of the insured's manufacture, sale, serving, furnishing, or distribution of alcoholic beverages, including claims arising from causing or contributing to a person's intoxication, or violation of any statute relating to the sale or serving of alcoholic beverages. A separate Liquor Liability policy is required for this exposure.",
      },
      {
        number: "5.2",
        heading: "Employee Injury Exclusion",
        body: "This policy does NOT cover bodily injury to an employee arising out of and in the course of employment. Such injuries are covered exclusively under the insured's Workers' Compensation and Employers' Liability policy.",
      },
      {
        number: "6",
        heading: "Limits of Insurance",
        body: "Per-Occurrence Limit: $1,000,000. General Aggregate Limit: $2,000,000. These limits apply regardless of the number of claims, claimants, or insureds involved in an occurrence.",
      },
    ],
  },
  {
    key: "workers-compensation",
    filename: "workers-compensation-policy.pdf",
    title: "Workers' Compensation and Employers' Liability Policy — Jane's Kitchen LLC",
    sections: [
      {
        number: "1",
        heading: "Declarations",
        body: "Named Insured: Jane's Kitchen LLC. Business Description: Full-service restaurant, 20 employees. Governing Classification: Restaurant — food and beverage service employees.",
      },
      {
        number: "2",
        heading: "Coverage A — Workers' Compensation",
        body: "We will pay, on behalf of the insured, the statutory workers' compensation benefits required in the state where the injury occurs for bodily injury by accident or disease sustained by an employee arising out of and in the course of employment. Benefits include medical treatment, wage replacement, and disability benefits as required by state law, with no dollar limit, as mandated by statute.",
      },
      {
        number: "3",
        heading: "Coverage B — Employers' Liability",
        body: "We will pay damages the insured is legally obligated to pay because of bodily injury to an employee that arises out of and in the course of employment, and that is not covered by the workers' compensation statute (for example, a spouse's loss-of-consortium claim). Limit: $500,000 per accident, $500,000 per employee for disease, $500,000 policy limit for disease.",
      },
      {
        number: "4",
        heading: "Exclusions",
        body: "This policy does not cover injuries to employees intentionally caused by the insured, injuries arising from an employee's intoxication where the insured can show the injury was caused by that intoxication, or liability the insured assumes under a contract that would not otherwise attach.",
      },
      {
        number: "5",
        heading: "Limits of Insurance",
        body: "Coverage A benefits are paid at the statutory amount with no dollar cap. Coverage B (Employers' Liability) limit: $500,000 per accident / $500,000 per employee (disease) / $500,000 policy limit (disease).",
      },
    ],
  },
  {
    key: "commercial-property",
    filename: "commercial-property-policy.pdf",
    title: "Commercial Property Policy — Jane's Kitchen LLC",
    sections: [
      {
        number: "1",
        heading: "Declarations",
        body: "Named Insured: Jane's Kitchen LLC. Covered Location: the restaurant premises leased by the insured. Building Limit: $300,000 (improvements and betterments). Business Personal Property Limit: $150,000. Deductible: $2,500 per claim.",
      },
      {
        number: "2",
        heading: "Covered Property",
        body: "This policy covers the building improvements and betterments the insured has made to the leased premises, and business personal property including kitchen equipment, refrigeration units, furniture, fixtures, inventory, and dining-room furnishings, up to the limits shown in the Declarations.",
      },
      {
        number: "3",
        heading: "Covered Causes of Loss",
        body: "This policy covers direct physical loss or damage to covered property caused by fire, lightning, windstorm, explosion, theft, vandalism, and burst pipes, subject to the exclusions below and the deductible shown in the Declarations.",
      },
      {
        number: "4.1",
        heading: "Flood Exclusion",
        body: "This policy does NOT cover loss or damage caused directly or indirectly by flood, surface water, waves, tidal water, or overflow of any body of water, whether or not driven by wind. A separate flood insurance policy is required for this exposure.",
      },
      {
        number: "4.2",
        heading: "Earthquake Exclusion",
        body: "This policy does NOT cover loss or damage caused directly or indirectly by earthquake, landslide, or other earth movement. A separate earthquake policy or endorsement is required for this exposure.",
      },
      {
        number: "5",
        heading: "Limits of Insurance and Deductibles",
        body: "Building (improvements and betterments): $300,000. Business Personal Property: $150,000. Deductible: $2,500 per claim, applied before any loss payment.",
      },
    ],
  },
];
