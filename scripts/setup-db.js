#!/usr/bin/env node
/**
 * FANTACER Database Setup Script
 * Usage: node scripts/setup-db.js
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zdfverdwdsigizxktilz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkZnZlcmR3ZHNpZ2l6eGt0aWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTk1MzQsImV4cCI6MjA5MjE3NTUzNH0.4nj-uVGaf_5MraCutPFZ7vr0VkjeCoOtD1DspKQFwsQ';

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY env required');
  process.exit(1);
}

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function execSQL(sql) {
  console.log('Executing SQL...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  console.log('Success:', data);
}

async function insertCompanies(companies) {
  console.log(`Inserting ${companies.length} companies...`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(companies)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  console.log(`Inserted ${companies.length} companies`);
}

const testCompanies = [
  { name: 'TechnoVision Srl', category: 'Technology', description: 'Innovative tech solutions' },
  { name: 'GreenEnergy SpA', category: 'Energy', description: 'Renewable energy provider' },
  { name: 'FinanceHub Italia', category: 'Finance', description: 'Financial consulting' },
  { name: 'MediCare Plus', category: 'Health', description: 'Healthcare services' },
  { name: 'FoodTaste Corp', category: 'Food', description: 'Premium food products' },
  { name: 'RetailMasters', category: 'Retail', description: 'Retail chain' },
  { name: 'LogiFast Srl', category: 'Logistics', description: 'Logistics & shipping' },
  { name: 'BuildRight Construction', category: 'Construction', description: 'Construction company' },
  { name: 'AutoDrive Italia', category: 'Automotive', description: 'Auto dealer' },
  { name: 'TravelEasy Agency', category: 'Tourism', description: 'Travel agency' },
  { name: 'EduLearn Institute', category: 'Education', description: 'Education services' },
  { name: 'SportFit Club', category: 'Sport', description: 'Sports center' },
  { name: 'FashionStyle Spa', category: 'Fashion', description: 'Fashion brand' },
  { name: 'MediaChannel Italia', category: 'Media', description: 'Media company' },
  { name: 'AgriGreen Farm', category: 'Agriculture', description: 'Organic farm' },
  { name: 'TechCloud Solutions', category: 'Technology', description: 'Cloud services' },
  { name: 'CyberSecure Corp', category: 'Technology', description: 'Cybersecurity' },
  { name: 'DataWave Analytics', category: 'Technology', description: 'Data analytics' },
  { name: 'AIoT Innovation', category: 'Technology', description: 'IoT solutions' },
  { name: 'Blockchain Tech', category: 'Technology', description: 'Blockchain services' },
  { name: 'BankingTech', category: 'Finance', description: 'Fintech' },
  { name: 'PayTech Solutions', category: 'Finance', description: 'Payment solutions' },
  { name: 'CryptoVault', category: 'Finance', description: 'Crypto services' },
  { name: 'WealthManage Italia', category: 'Finance', description: 'Wealth management' },
  { name: 'FoodChain Supply', category: 'Food', description: 'Food supply' },
  { name: 'OrganicFarm Italia', category: 'Food', description: 'Organic products' },
  { name: 'WineEstate Tuscany', category: 'Food', description: 'Wine producer' },
  { name: 'PhytoCare Pharma', category: 'Health', description: 'Pharma' },
  { name: 'DentalCare Plus', category: 'Health', description: 'Dental clinic' },
  { name: 'FitGym Italia', category: 'Sport', description: 'Gym chain' },
  { name: 'YogaSpace Studio', category: 'Sport', description: 'Yoga studio' },
  { name: 'FashionHouse Milano', category: 'Fashion', description: 'Fashion house' },
  { name: 'CosmeticsLab', category: 'Beauty', description: 'Cosmetics' },
  { name: 'SpaWellness Center', category: 'Beauty', description: 'Spa' },
  { name: 'HairStyle Pro', category: 'Beauty', description: 'Hair salon' },
  { name: 'ConsultingPro', category: 'Consulting', description: 'Consulting' },
  { name: 'StrategyAdvisors', category: 'Consulting', description: 'Strategy' },
  { name: 'RealEstateDev', category: 'Real Estate', description: 'Real estate' },
  { name: 'PropertyGroup', category: 'Real Estate', description: 'Property' },
  { name: 'HardwareStore', category: 'Retail', description: 'Hardware' },
  { name: 'ElectronicsStore', category: 'Retail', description: 'Electronics' },
  { name: 'WebDesign Pro', category: 'Technology', description: 'Web design' },
  { name: 'AppDeveloper', category: 'Technology', description: 'Apps' },
  { name: 'SoftwareHouse', category: 'Technology', description: 'Software' },
  { name: 'CloudServices', category: 'Technology', description: 'Cloud' },
  { name: 'TelecomItalia', category: 'Telecom', description: 'Telecom' },
  { name: 'MediaGroup Italia', category: 'Media', description: 'Media' },
  { name: 'TVChannel', category: 'Media', description: 'Television' },
  { name: 'MarketingPro', category: 'Marketing', description: 'Marketing' },
  { name: 'DigitalMarketing', category: 'Marketing', description: 'Digital marketing' },
  { name: 'SEOAgency', category: 'Marketing', description: 'SEO' },
  { name: 'SalesForce Italia', category: 'Sales', description: 'Sales' },
  { name: 'CRMSolutions', category: 'Sales', description: 'CRM' },
  { name: 'InvoiceAutomation', category: 'Finance', description: 'Invoicing' },
  { name: 'PaymentGateway', category: 'Finance', description: 'Payments' },
  { name: 'QuickFix Srl', category: 'Services', description: 'Quick solutions' },
  { name: 'HandyMan Pro', category: 'Services', description: 'Handyman services' },
  { name: 'CleanFast Italia', category: 'Services', description: 'Cleaning' },
  { name: 'Security Plus', category: 'Services', description: 'Security' },
  { name: 'LegalHelp Corp', category: 'Services', description: 'Legal services' },
  { name: 'HR Solutions', category: 'Services', description: 'HR services' },
  { name: 'TranslationPro', category: 'Services', description: 'Translation' },
  { name: 'CateringPremium', category: 'Food', description: 'Catering services' },
  { name: 'SuperBio Market', category: 'Food', description: 'Organic supermarket' },
  { name: 'CoffeeRoasters Italia', category: 'Food', description: 'Coffee roaster' },
  { name: 'BeerCraft Brewery', category: 'Food', description: 'Craft beer' },
  { name: 'ChocolateFactory', category: 'Food', description: 'Chocolate maker' },
  { name: 'BakeryArtisan', category: 'Food', description: 'Artisan bakery' },
  { name: 'Pizzeria Napoli', category: 'Food', description: 'Pizza chain' },
  { name: 'MedRobotics', category: 'Health', description: 'Medical robots' },
  { name: 'HealthAI Systems', category: 'Health', description: 'Health AI' },
  { name: 'EcoGreen Energy', category: 'Energy', description: 'Eco energy' },
  { name: 'SolarPower Italia', category: 'Energy', description: 'Solar energy' },
  { name: 'WindForce Corp', category: 'Energy', description: 'Wind energy' },
  { name: 'BioGas Industries', category: 'Energy', description: 'Biogas production' },
  { name: 'SmartGrid Italia', category: 'Energy', description: 'Smart grid' },
  { name: 'InsureTech Corp', category: 'Finance', description: 'Insurtech' },
  { name: 'CoinExchange', category: 'Finance', description: 'Crypto exchange' },
  { name: 'StockInvest Corp', category: 'Finance', description: 'Stock investment' },
  { name: 'ventureCapital Italia', category: 'Finance', description: 'VC firm' },
  { name: 'PrivateEquity Group', category: 'Finance', description: 'Private equity' },
  { name: 'LeaseFlow Auto', category: 'Finance', description: 'Auto leasing' },
  { name: 'TradeFinance Global', category: 'Finance', description: 'Trade finance' },
  { name: 'BondMarket Italia', category: 'Finance', description: 'Bond trading' },
  { name: 'WellnessCenter Spa', category: 'Wellness', description: 'Wellness center' },
  { name: 'MeditationHub', category: 'Wellness', description: 'Meditation' },
  { name: 'AromaTherapy', category: 'Wellness', description: 'Aromatherapy' },
  { name: 'MassageTherapy', category: 'Wellness', description: 'Massage' },
  { name: 'HolisticHealth', category: 'Wellness', description: 'Holistic' },
  { name: 'MindfulnessCenter', category: 'Wellness', description: 'Mindfulness' },
  { name: 'ZenGarden Italia', category: 'Wellness', description: 'Zen center' },
  { name: 'RetreatWellness', category: 'Wellness', description: 'Retreat' },
  { name: 'NatureCure', category: 'Wellness', description: 'Nature cure' },
  { name: 'ManagementConsult', category: 'Consulting', description: 'Management' },
  { name: 'AuditPartners', category: 'Consulting', description: 'Audit' },
  { name: 'TaxLegalConsult', category: 'Consulting', description: 'Tax legal' },
  { name: 'HRConsulting', category: 'Consulting', description: 'HR consulting' },
  { name: 'LegalTech', category: 'Consulting', description: 'Legal tech' },
  { name: 'PatentAttorney', category: 'Consulting', description: 'Patents' },
  { name: 'ComplianceCorp', category: 'Consulting', description: 'Compliance' },
  { name: 'RiskManagement', category: 'Consulting', description: 'Risk' },
  { name: 'BusinessConsult', category: 'Consulting', description: 'Business' },
  { name: 'CorporateAdvisors', category: 'Consulting', description: 'Corporate' }
];

async function main() {
  try {
    await insertCompanies(testCompanies);
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();