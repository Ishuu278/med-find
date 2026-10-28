"""
chatbot.py — MedFind AI Medical Information & Support System Engine.
Provides comprehensive medicine details, symptom guidance, real-time stock lookup,
reservation tracking, support ticket submission, and emergency health helplines.
"""

import re
import random
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Comprehensive Medicine Knowledge Base
# Covers all medicines in MedFind database + major OTC and common prescriptions
# ---------------------------------------------------------------------------
MEDICINES_KB = {
    "paracetamol": {
        "name": "Paracetamol",
        "aliases": ["dolo", "dolo 650", "crocin", "calpol", "pacimol", "acetaminophen"],
        "category": "Analgesic & Antipyretic",
        "description": "Widely used medicine for relieving mild to moderate pain and reducing fever.",
        "primary_uses": [
            "Fever reduction (antipyretic)",
            "Headache, toothache, and earache",
            "Mild to moderate muscle and body aches",
            "Post-vaccination fever and discomfort",
            "Osteoarthritis mild pain management"
        ],
        "dosage_instructions": "Adults: 500mg to 650mg every 4 to 6 hours as needed. Maximum daily limit: 4,000mg (4g) in 24 hours.",
        "how_to_take": "Can be taken with or without food. Drink a full glass of water. Maintain at least 4 hours between consecutive doses.",
        "common_side_effects": ["Mild nausea", "Stomach discomfort (rare)"],
        "warnings": [
            "⚠️ Overdose Warning: Exceeding 4,000mg/day can cause severe, irreversible liver damage.",
            "⚠️ Avoid combining with other cold/cough medications that also contain paracetamol.",
            "⚠️ Avoid consuming alcohol while taking this medication as it increases liver toxicity risk.",
            "⚠️ Consult your doctor if fever persists for more than 3 consecutive days."
        ],
        "prescription_required": False,
        "available_forms": ["Tablet (500mg, 650mg)", "Syrup (120mg/5ml, 250mg/5ml)", "Drops"],
        "brand_equivalents": ["Dolo 650", "Crocin 500/650", "Calpol", "Tylenol"]
    },
    "dolo 650": {
        "name": "Dolo 650",
        "aliases": ["dolo", "paracetamol 650"],
        "category": "Analgesic & Antipyretic (High Strength)",
        "description": "Popular high-strength Paracetamol (650mg) formulation for acute fever and body pain.",
        "primary_uses": [
            "High fever associated with viral flu, colds, or dengue",
            "Intense headaches, migraines, and toothache",
            "Severe muscle aches, backaches, and joint pains"
        ],
        "dosage_instructions": "Adults: 1 tablet (650mg) up to 3 to 4 times a day, spaced at least 4-6 hours apart. Do not take more than 4 tablets in 24 hours.",
        "how_to_take": "Swallow whole with a glass of water, ideally after meals to prevent any gastric irritation.",
        "common_side_effects": ["Nausea", "Mild stomach pain"],
        "warnings": [
            "⚠️ Maximum 4 tablets (2,600mg) per day without medical supervision.",
            "⚠️ Do not consume alcohol during course.",
            "⚠️ Caution if you have pre-existing liver or kidney impairment."
        ],
        "prescription_required": False,
        "available_forms": ["Tablet (650mg)"],
        "brand_equivalents": ["Crocin 650", "Pacimol 650", "Calpol 650"]
    },
    "crocin": {
        "name": "Crocin",
        "aliases": ["crocin 500", "crocin advance", "crocin pain relief"],
        "category": "Analgesic & Antipyretic",
        "description": "Fast-acting Paracetamol brand for fever and pain relief with rapid release technology.",
        "primary_uses": [
            "Quick relief from fever and chills",
            "Headaches, dental pain, and body aches",
            "Menstrual cramps and sore throat"
        ],
        "dosage_instructions": "Adults: 1-2 tablets (500mg each) every 4-6 hours. Max 4,000mg per 24 hours.",
        "how_to_take": "Take with water. Effective on an empty stomach or with food.",
        "common_side_effects": ["Rare mild allergic skin rash", "Transient nausea"],
        "warnings": [
            "⚠️ Strict limit: Do not take more than 8 x 500mg tablets in 24 hours.",
            "⚠️ Avoid mixing with other paracetamol-containing combination drugs."
        ],
        "prescription_required": False,
        "available_forms": ["Tablet (500mg, 650mg)", "Syrup for children"],
        "brand_equivalents": ["Dolo 650", "Calpol", "Paracetamol generic"]
    },
    "combiflam": {
        "name": "Combiflam",
        "aliases": ["ibuprofen paracetamol", "flexon"],
        "category": "NSAID + Analgesic Combination",
        "description": "Combination medication containing Ibuprofen (400mg) and Paracetamol (325mg) for inflammation and moderate-to-severe pain.",
        "primary_uses": [
            "Severe headaches and toothaches",
            "Joint pain, sprains, sports injuries, and arthritis flare-ups",
            "Musculoskeletal pain and backache",
            "Fever with severe body ache"
        ],
        "dosage_instructions": "Adults: 1 tablet 2 to 3 times daily, strictly with or after meals. Maintain 8 hours between doses.",
        "how_to_take": "ALWAYS take with food or milk to safeguard the stomach lining against NSAID-induced acidity or ulcers.",
        "common_side_effects": ["Heartburn", "Acidity / stomach ache", "Nausea", "Dizziness"],
        "warnings": [
            "⚠️ Do NOT take on an empty stomach.",
            "⚠️ Contraindicated in patients with active peptic ulcers, gastrointestinal bleeding, or severe kidney disease.",
            "⚠️ Not recommended during late pregnancy (3rd trimester) or in patients with asthma sensitive to aspirin/NSAIDs."
        ],
        "prescription_required": False,
        "available_forms": ["Tablet (Ibuprofen 400mg + Paracetamol 325mg)"],
        "brand_equivalents": ["Flexon", "Ibugesic Plus"]
    },
    "amoxicillin": {
        "name": "Amoxicillin",
        "aliases": ["mox", "novamox", "amoxil", "augmentin"],
        "category": "Broad-Spectrum Penicillin Antibiotic",
        "description": "Bactericidal antibiotic used to treat bacterial infections of the respiratory tract, ear, throat, urinary tract, and skin.",
        "primary_uses": [
            "Bacterial throat infections (strep throat, tonsillitis)",
            "Middle ear infections (otitis media) and sinusitis",
            "Bronchitis and community-acquired pneumonia",
            "Urinary tract infections (UTIs)",
            "Dental abscesses and skin bacterial infections"
        ],
        "dosage_instructions": "Adults: Usually 250mg to 500mg every 8 hours, or 500mg to 875mg every 12 hours for 5 to 10 days, strictly as prescribed by a physician.",
        "how_to_take": "Can be taken with or without meals. Finish the FULL prescribed course even if symptoms resolve early to prevent antibiotic resistance.",
        "common_side_effects": ["Diarrhea", "Stomach cramps", "Mild nausea", "Skin rash"],
        "warnings": [
            "⚠️ NEVER use for viral illnesses like the common cold, flu, or viral cough — antibiotics have NO effect on viruses.",
            "⚠️ Do NOT take if you have a known Penicillin or cephalosporin allergy (can cause life-threatening anaphylaxis).",
            "⚠️ Complete the full duration prescribed to prevent developing multi-drug resistant superbugs."
        ],
        "prescription_required": True,
        "available_forms": ["Capsule (250mg, 500mg)", "Syrup / Dry Suspension (125mg/5ml, 250mg/5ml)"],
        "brand_equivalents": ["Mox 500", "Novamox", "Amoxil", "Augmentin (Amoxicillin + Clavulanate)"]
    },
    "metformin": {
        "name": "Metformin",
        "aliases": ["glycomet", "glucophage", "glumetza"],
        "category": "Biguanide Oral Antidiabetic",
        "description": "First-line prescription medication for managing Type 2 Diabetes Mellitus and Polycystic Ovary Syndrome (PCOS).",
        "primary_uses": [
            "Lowering high blood glucose levels in Type 2 Diabetes",
            "Improving insulin sensitivity in cells",
            "Management of insulin resistance in PCOS",
            "Cardiovascular risk reduction in diabetic patients"
        ],
        "dosage_instructions": "Starting dose: 500mg once or twice daily with meals. May be titrated up to 1,000mg twice daily under doctor supervision. Extended release (XR) taken once daily with dinner.",
        "how_to_take": "Must be taken WITH or immediately AFTER meals to minimize gastrointestinal discomfort.",
        "common_side_effects": ["Metallic taste in mouth", "Bloating", "Diarrhea", "Flatulence", "Mild stomach upset"],
        "warnings": [
            "⚠️ Long-term use can reduce Vitamin B12 absorption; periodic monitoring is advised.",
            "⚠️ Rare but serious risk of Lactic Acidosis in patients with acute renal impairment or severe dehydration.",
            "⚠️ Discontinue temporarily before undergoing medical imaging procedures involving iodinated contrast dye."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (500mg, 850mg, 1000mg)", "Extended Release SR/ER (500mg, 1000mg)"],
        "brand_equivalents": ["Glycomet 500/1000", "Glucophage", "Obimet"]
    },
    "cetirizine": {
        "name": "Cetirizine",
        "aliases": ["cetzine", "zyrtec", "alerid", "okacet"],
        "category": "Second-Generation Antihistamine",
        "description": "Effective anti-allergy medication that provides 24-hour relief from allergic rhinitis, hives, and itchy skin without strong sedative effects.",
        "primary_uses": [
            "Allergic rhinitis: sneezing, runny nose, and itchy watery eyes",
            "Hay fever and seasonal pollen allergies",
            "Chronic urticaria (itching, skin hives, and wheals)",
            "Allergic reactions to insect bites or dust mites"
        ],
        "dosage_instructions": "Adults and children over 12: 10mg once daily. For mild symptoms, 5mg once daily.",
        "how_to_take": "Take once daily with water, preferably at bedtime as it may cause mild drowsiness.",
        "common_side_effects": ["Mild drowsiness or fatigue", "Dry mouth", "Headache"],
        "warnings": [
            "⚠️ Caution when driving, operating machinery, or performing tasks requiring high alertness.",
            "⚠️ Avoid concurrent alcohol consumption as it deepens sedation.",
            "⚠️ Dose adjustment required in patients with moderate to severe renal impairment."
        ],
        "prescription_required": False,
        "available_forms": ["Tablet (10mg)", "Syrup (5mg/5ml)"],
        "brand_equivalents": ["Cetzine", "Zyrtec", "Alerid", "Okacet"]
    },
    "azithromycin": {
        "name": "Azithromycin",
        "aliases": ["azithral", "zithromax", "azee"],
        "category": "Macrolide Antibiotic",
        "description": "Broad-spectrum macrolide antibiotic commonly prescribed in 3-day or 5-day courses for bacterial respiratory and systemic infections.",
        "primary_uses": [
            "Upper and lower respiratory tract infections (bronchitis, pneumonia)",
            "Bacterial pharyngitis and tonsillitis",
            "Sinusitis and ear infections",
            "Uncomplicated skin and soft tissue bacterial infections",
            "Certain sexually transmitted bacterial infections (e.g., chlamydia)"
        ],
        "dosage_instructions": "Typical adult regimen: 500mg once daily for 3 consecutive days, OR 500mg on day 1 followed by 250mg once daily on days 2 to 5.",
        "how_to_take": "Can be taken with or without food. If stomach upset occurs, take with a light meal. Swallow tablet whole with plenty of fluids.",
        "common_side_effects": ["Nausea", "Diarrhea", "Abdominal discomfort", "Headache"],
        "warnings": [
            "⚠️ Complete the full course even if you feel significantly better after 24 hours.",
            "⚠️ Do NOT take simultaneously with antacids containing aluminum or magnesium; separate by at least 2 hours.",
            "⚠️ Inform your doctor if you have cardiac rhythm disorders (QT prolongation history)."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (250mg, 500mg)", "Oral Suspension (100mg/5ml, 200mg/5ml)"],
        "brand_equivalents": ["Azithral 500", "Azee 500", "Zithromax"]
    },
    "ibuprofen": {
        "name": "Ibuprofen",
        "aliases": ["brufen", "advil", "motrin"],
        "category": "Non-Steroidal Anti-Inflammatory Drug (NSAID)",
        "description": "Potent anti-inflammatory, pain reliever, and fever reducer that targets inflammation at its source.",
        "primary_uses": [
            "Inflammatory joint pain (rheumatoid arthritis, osteoarthritis)",
            "Muscle aches, sprains, strains, and post-workout soreness",
            "Menstrual pain (dysmenorrhea)",
            "Dental pain, toothache, and headache",
            "Post-operative swelling and pain"
        ],
        "dosage_instructions": "Adults: 200mg to 400mg every 4 to 6 hours as needed. Maximum recommended daily dose is 1,200mg (OTC) or up to 2,400mg under medical supervision.",
        "how_to_take": "CRITICAL: ALWAYS take with or immediately following food or a glass of milk to safeguard the gastrointestinal tract.",
        "common_side_effects": ["Stomach burning / dyspepsia", "Nausea", "Mild dizziness"],
        "warnings": [
            "⚠️ DO NOT take on an empty stomach.",
            "⚠️ Contraindicated in individuals with active stomach ulcers, GI bleeding, heart failure, or severe kidney disease.",
            "⚠️ Avoid in the 3rd trimester of pregnancy.",
            "⚠️ Long-term high doses increase cardiovascular and kidney risk."
        ],
        "prescription_required": False,
        "available_forms": ["Tablet (200mg, 400mg, 600mg)", "Syrup", "Topical Gel"],
        "brand_equivalents": ["Brufen 400", "Advil", "Motrin"]
    },
    "omeprazole": {
        "name": "Omeprazole",
        "aliases": ["omez", "prilosec", "omizac"],
        "category": "Proton Pump Inhibitor (PPI)",
        "description": "Reduces the amount of acid produced in the stomach, providing long-lasting healing for GERD and acid reflux.",
        "primary_uses": [
            "Gastroesophageal Reflux Disease (GERD) and chronic heartburn",
            "Stomach ulcers and duodenal ulcers",
            "Prevention of NSAID-induced gastric ulcers",
            "Zollinger-Ellison syndrome (hyperacidity)"
        ],
        "dosage_instructions": "Adults: 20mg once daily for 2 to 4 weeks. Severe cases may require 40mg daily.",
        "how_to_take": "Take ONCE daily in the morning, 30 to 60 minutes BEFORE breakfast with a full glass of water. Swallow capsule whole without chewing or crushing.",
        "common_side_effects": ["Headache", "Abdominal gas / bloating", "Mild diarrhea or constipation"],
        "warnings": [
            "⚠️ Do NOT crush or chew enteric-coated pellets inside capsule.",
            "⚠️ Extended use (> 1 year) can reduce absorption of Vitamin B12, Magnesium, and Calcium.",
            "⚠️ Consult a gastroenterologist if symptoms do not improve after 14 days."
        ],
        "prescription_required": False,
        "available_forms": ["Capsule (20mg, 40mg)"],
        "brand_equivalents": ["Omez 20", "Prilosec", "Omizac"]
    },
    "pantoprazole": {
        "name": "Pantoprazole",
        "aliases": ["pan 40", "pantocid", "protonix"],
        "category": "Proton Pump Inhibitor (PPI)",
        "description": "High-potency acid suppressor for persistent acidity, severe reflux, and stomach ulcer healing.",
        "primary_uses": [
            "Moderate to severe acid reflux / heartburn",
            "Healing erosive esophagitis",
            "Prevention and treatment of peptic ulcers",
            "Acid-related stomach burning sensation"
        ],
        "dosage_instructions": "Adults: 40mg once daily, typically for 4 to 8 weeks.",
        "how_to_take": "Swallow whole with water 30 to 60 minutes BEFORE breakfast. Do not chew, break, or crush the tablet.",
        "common_side_effects": ["Mild headache", "Diarrhea", "Abdominal discomfort"],
        "warnings": [
            "⚠️ Tablet must remain intact for enteric coating to protect the medicine from stomach acid.",
            "⚠️ Inform doctor if taking with Clopidogrel, Methotrexate, or Digoxin.",
            "⚠️ Seek medical advice if you experience unexplained weight loss, persistent vomiting, or black stools."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (40mg)", "Injection (IV)"],
        "brand_equivalents": ["Pan 40", "Pantocid 40", "Protonix"]
    },
    "atorvastatin": {
        "name": "Atorvastatin",
        "aliases": ["atorva", "lipitor", "storvas"],
        "category": "HMG-CoA Reductase Inhibitor (Statin)",
        "description": "Cholesterol-lowering medication that reduces 'bad' LDL cholesterol and triglycerides while raising 'good' HDL cholesterol.",
        "primary_uses": [
            "Hypercholesterolemia (high blood cholesterol)",
            "Prevention of heart attacks, stroke, and cardiovascular events",
            "Slowing plaque buildup in coronary arteries"
        ],
        "dosage_instructions": "Starting dose: 10mg to 20mg once daily. Maintenance dose up to 40mg-80mg daily under lipid specialist guidance.",
        "how_to_take": "Take once daily at the same time each day (typically in the evening), with or without food.",
        "common_side_effects": ["Joint ache", "Mild indigestion", "Nausea"],
        "warnings": [
            "⚠️ Notify doctor immediately if you develop unexplained muscle pain, tenderness, or weakness (rare risk of rhabdomyolysis).",
            "⚠️ Avoid consuming large quantities of grapefruit juice (interferes with statin metabolism).",
            "⚠️ Strictly contraindicated during pregnancy and breastfeeding."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (10mg, 20mg, 40mg, 80mg)"],
        "brand_equivalents": ["Atorva", "Lipitor", "Storvas"]
    },
    "aspirin": {
        "name": "Aspirin",
        "aliases": ["ecospirin", "disprin", "bayer"],
        "category": "Antiplatelet / NSAID",
        "description": "Low-dose antiplatelet 'blood thinner' for heart protection and higher-dose analgesic.",
        "primary_uses": [
            "Secondary prevention of heart attack, angina, and ischemic stroke (75mg - 150mg daily)",
            "Post-stent and cardiac bypass graft maintenance",
            "Relief of pain and inflammation at higher doses (300mg - 600mg)"
        ],
        "dosage_instructions": "Heart protection: 75mg to 150mg once daily. Pain/fever: 325mg to 650mg every 4 to 6 hours.",
        "how_to_take": "Take enteric-coated tablets with or after food. Swallow whole with water to protect the stomach.",
        "common_side_effects": ["Mild indigestion", "Increased bleeding tendency (easy bruising)"],
        "warnings": [
            "⚠️ High risk of gastrointestinal bleeding with prolonged unmonitored use.",
            "⚠️ NEVER give aspirin to children or teenagers recovering from chickenpox or flu symptoms due to risk of fatal Reye's Syndrome.",
            "⚠️ Inform your dentist or surgeon before any planned surgical procedures."
        ],
        "prescription_required": False,
        "available_forms": ["Enteric Coated Tablet (75mg, 150mg)", "Dispersible Tablet (325mg)"],
        "brand_equivalents": ["Ecosprin 75/150", "Disprin", "Bayer Aspirin"]
    },
    "vitamin c": {
        "name": "Vitamin C (Ascorbic Acid)",
        "aliases": ["limcee", "celin", "ascorbic acid"],
        "category": "Essential Nutritional Antioxidant",
        "description": "Vital water-soluble vitamin supporting immunity, collagen synthesis, iron absorption, and wound healing.",
        "primary_uses": [
            "Immune system strengthening against seasonal colds",
            "Enhancing non-heme dietary iron absorption",
            "Skin health and tissue repair / wound healing",
            "Preventing and treating scurvy (Vitamin C deficiency)"
        ],
        "dosage_instructions": "Adults: 500mg once or twice daily. Dietary allowance (RDA) 75mg-90mg daily; therapeutic 500mg.",
        "how_to_take": "Chewable tablets should be chewed thoroughly before swallowing. Can be taken with or without food.",
        "common_side_effects": ["Mild stomach cramps if taken in excess (>2,000mg/day)", "Diarrhea at very high doses"],
        "warnings": [
            "⚠️ Excess Vitamin C is excreted in urine, but very high prolonged doses can increase risk of kidney stones in susceptible individuals.",
            "⚠️ Store in a dry place protected from sunlight and heat."
        ],
        "prescription_required": False,
        "available_forms": ["Chewable Tablet (500mg)", "Effervescent Tablet (1000mg)"],
        "brand_equivalents": ["Limcee 500", "Celin 500", "Redoxon"]
    },
    "montelukast": {
        "name": "Montelukast",
        "aliases": ["singulair", "telekast", "montair"],
        "category": "Leukotriene Receptor Antagonist (LTRA)",
        "description": "Anti-inflammatory airway medication that blocks leukotrienes to prevent asthma flare-ups and allergy symptoms.",
        "primary_uses": [
            "Maintenance therapy and prevention of chronic asthma",
            "Prevention of exercise-induced bronchospasm",
            "Relief from seasonal and perennial allergic rhinitis",
            "Often combined with Levocetirizine for severe allergic sneezing and asthma"
        ],
        "dosage_instructions": "Adults: 10mg once daily in the evening.",
        "how_to_take": "Take with water, with or without food, consistently in the evening.",
        "common_side_effects": ["Headache", "Upper respiratory tract infection symptoms", "Stomach ache"],
        "warnings": [
            "⚠️ Not a rescue inhaler! Do NOT use to treat an acute sudden asthma attack (use Salbutamol inhaler instead).",
            "⚠️ Monitor for mood changes, vivid dreams, or anxiety (rare neuropsychiatric events); report to physician immediately."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (10mg)", "Chewable Tablet (4mg, 5mg)"],
        "brand_equivalents": ["Telekast 10", "Montair 10", "Singulair"]
    },
    "amlodipine": {
        "name": "Amlodipine",
        "aliases": ["norvasc", "amlong", "stamlo"],
        "category": "Dihydropyridine Calcium Channel Blocker",
        "description": "Relaxes vascular smooth muscle and dilates blood vessels to lower elevated arterial blood pressure and prevent chest pain.",
        "primary_uses": [
            "Hypertension (high blood pressure management)",
            "Chronic stable angina (exertional chest pain)",
            "Vasospastic (Prinzmetal's) angina"
        ],
        "dosage_instructions": "Adults: Starting dose 5mg once daily; may be increased to 10mg daily based on target blood pressure goals.",
        "how_to_take": "Take once daily with water, with or without food, at the same time each day.",
        "common_side_effects": ["Peripheral edema (ankle or foot swelling)", "Flushing", "Dizziness", "Palpitations"],
        "warnings": [
            "⚠️ Do NOT stop taking abruptly without consulting doctor as rebound hypertension can occur.",
            "⚠️ Stand up slowly from sitting or lying position to prevent dizziness or postural hypotension.",
            "⚠️ Monitor your blood pressure regularly."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (2.5mg, 5mg, 10mg)"],
        "brand_equivalents": ["Amlong 5", "Norvasc", "Stamlo"]
    },
    "telmisartan": {
        "name": "Telmisartan",
        "aliases": ["micardis", "telma", "telmikem"],
        "category": "Angiotensin II Receptor Blocker (ARB)",
        "description": "Cardioprotective antihypertensive medication that blocks angiotensin II receptors to reduce high blood pressure and protect kidneys.",
        "primary_uses": [
            "Essential hypertension (high blood pressure)",
            "Cardiovascular risk reduction in patients over 55 unable to tolerate ACE inhibitors",
            "Diabetic nephropathy renal protection"
        ],
        "dosage_instructions": "Adults: 40mg once daily; can range from 20mg to 80mg daily.",
        "how_to_take": "Take once daily with water, with or without food, preferably in the morning.",
        "common_side_effects": ["Dizziness", "Back pain", "Sinus congestion", "Fatigue"],
        "warnings": [
            "⚠️ STRICTLY CONTRAINDICATED in pregnancy (causes fetal toxicity and injury).",
            "⚠️ Check serum potassium and kidney function periodically.",
            "⚠️ Avoid taking potassium supplements or salt substitutes without doctor approval."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (20mg, 40mg, 80mg)"],
        "brand_equivalents": ["Telma 40", "Micardis", "Telmikem"]
    },
    "levothyroxine": {
        "name": "Levothyroxine",
        "aliases": ["thyronorm", "eltroxin", "synthroid"],
        "category": "Synthetic Thyroid Hormone (T4)",
        "description": "Bioidentical replacement for deficient thyroid hormone in primary, secondary, or tertiary hypothyroidism.",
        "primary_uses": [
            "Hypothyroidism (underactive thyroid gland)",
            "Goiter management and thyroid cancer suppression therapy",
            "Restoring metabolic rate, body temperature, and energy balance"
        ],
        "dosage_instructions": "Individually adjusted according to serum TSH levels. Common doses: 25mcg, 50mcg, 75mcg, 100mcg once daily.",
        "how_to_take": "CRITICAL: Must be taken on an EMPTY STOMACH with a full glass of water, at least 30 to 60 minutes before breakfast, tea, or coffee.",
        "common_side_effects": ["Overreplacement signs: palpitations, insomnia, tremors, weight loss, heat intolerance"],
        "warnings": [
            "⚠️ Do NOT take with calcium, iron supplements, antacids, or soy products within 4 hours (drastically reduces absorption).",
            "⚠️ Lifelong daily medication for most patients with primary hypothyroidism; do not skip doses.",
            "⚠️ Test TSH every 6 to 12 weeks during dose titration."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (12.5mcg, 25mcg, 50mcg, 75mcg, 100mcg, 125mcg)"],
        "brand_equivalents": ["Thyronorm 50", "Eltroxin", "Synthroid"]
    },
    "ciprofloxacin": {
        "name": "Ciprofloxacin",
        "aliases": ["ciptox", "ciplox", "cipro"],
        "category": "Fluoroquinolone Antibiotic",
        "description": "Potent bactericidal antibiotic targeting complicated urinary, gastrointestinal, and systemic bacterial infections.",
        "primary_uses": [
            "Complicated urinary tract infections (UTIs) and pyelonephritis",
            "Bacterial diarrhea, typhoid fever, and infectious gastroenteritis",
            "Bone and joint infections",
            "Certain severe respiratory infections"
        ],
        "dosage_instructions": "Adults: 250mg to 500mg twice daily (every 12 hours) for 3 to 14 days based on infection site.",
        "how_to_take": "Take with full glass of water. Can take with or without food. Stay well hydrated throughout therapy.",
        "common_side_effects": ["Nausea", "Diarrhea", "Headache", "Abdominal discomfort"],
        "warnings": [
            "⚠️ Black box warning: Risk of tendinitis and tendon rupture (especially Achilles tendon) and peripheral neuropathy.",
            "⚠️ Avoid taking with dairy products (milk, yogurt) or calcium-fortified juice alone; separate by 2 hours.",
            "⚠️ Avoid intense sun exposure (causes photosensitivity). Stop and notify doctor immediately if joint or tendon pain occurs."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (250mg, 500mg)", "Eye/Ear Drops", "IV Infusion"],
        "brand_equivalents": ["Ciplox 500", "Cipro", "Cifran"]
    },
    "doxycycline": {
        "name": "Doxycycline",
        "aliases": ["dox", "doxypal", "vibramycin"],
        "category": "Tetracycline Antibiotic",
        "description": "Versatile broad-spectrum antibiotic for acne, tick-borne infections, respiratory tract infections, and malaria prophylaxis.",
        "primary_uses": [
            "Severe acne vulgaris and rosacea",
            "Atypical pneumonia, bronchitis, and sinusitis",
            "Lyme disease, typhus, and rickettsial infections",
            "Chlamydia and pelvic inflammatory diseases",
            "Malaria prophylaxis for travelers"
        ],
        "dosage_instructions": "Adults: 100mg once or twice daily (every 12 hours) for prescribed duration.",
        "how_to_take": "CRITICAL: Swallow with a FULL glass of water while SITTING OR STANDING upright. Do NOT lie down for at least 30 minutes after swallowing to prevent severe esophageal irritation or ulceration.",
        "common_side_effects": ["Nausea", "Stomach upset", "Sun sensitivity (phototoxicity)"],
        "warnings": [
            "⚠️ Never lie down immediately after taking.",
            "⚠️ Contraindicated in children under 8 years and pregnant women (causes permanent tooth discoloration and enamel hypoplasia).",
            "⚠️ Do not take simultaneously with antacids, iron supplements, or dairy products (separate by 2-3 hours)."
        ],
        "prescription_required": True,
        "available_forms": ["Capsule (100mg)", "Tablet (100mg)"],
        "brand_equivalents": ["Doxypal 100", "Vibramycin", "Microdox"]
    },
    "salbutamol": {
        "name": "Salbutamol",
        "aliases": ["albuterol", "asthalin", "ventolin"],
        "category": "Short-Acting Beta-2 Agonist (SABA) Bronchodilator",
        "description": "Fast-acting rescue bronchodilator that relaxes bronchial smooth muscles within minutes to open constricted airways.",
        "primary_uses": [
            "Quick relief from acute asthma attack, wheezing, and shortness of breath",
            "Prevention and treatment of exercise-induced bronchospasm",
            "Relief in Chronic Obstructive Pulmonary Disease (COPD) exacerbation"
        ],
        "dosage_instructions": "Metered Dose Inhaler (MDI): 1 to 2 puffs (100mcg - 200mcg) as needed for sudden shortness of breath. Maximum 8 puffs in 24 hours.",
        "how_to_take": "Shake inhaler well, exhale fully, place mouthpiece between lips, depress canister while breathing in slowly and deeply, then hold breath for 10 seconds. Rinse mouth with water after use.",
        "common_side_effects": ["Fine tremor in hands", "Temporary fast heartbeat (palpitations)", "Mild nervousness or restlessness"],
        "warnings": [
            "⚠️ This is a RESCUE medication for acute symptoms; if you need to use it more than 2-3 times a week, consult doctor to step up maintenance anti-inflammatory preventer medication.",
            "⚠️ If shortness of breath does not improve within 10-15 minutes, seek immediate emergency medical care."
        ],
        "prescription_required": True,
        "available_forms": ["Metered Dose Inhaler (100mcg/actuation)", "Rotacaps", "Nebulizer Solution", "Syrup"],
        "brand_equivalents": ["Asthalin Inhaler", "Ventolin", "Aerolin"]
    },
    "clopidogrel": {
        "name": "Clopidogrel",
        "aliases": ["plavix", "clopilet", "ceruvit"],
        "category": "P2Y12 Platelet Inhibitor (Antiplatelet)",
        "description": "Blood-thinning antiplatelet medicine that prevents blood clots inside coronary stents and diseased arteries.",
        "primary_uses": [
            "Prevention of stent thrombosis after coronary angioplasty",
            "Reducing risk of recurrent stroke and heart attack",
            "Peripheral arterial disease management",
            "Acute coronary syndrome (often dual therapy with Aspirin)"
        ],
        "dosage_instructions": "Maintenance: 75mg once daily. Loading dose (in hospital setting) 300mg to 600mg.",
        "how_to_take": "Take once daily with water, with or without food, at the same consistent time each day.",
        "common_side_effects": ["Increased bleeding time", "Easy bruising", "Epistaxis (nosebleeds)"],
        "warnings": [
            "⚠️ Do NOT stop taking this medication abruptly without consulting your cardiologist, especially if you have a cardiac stent (high risk of fatal stent thrombosis).",
            "⚠️ Inform all physicians, dentists, and surgeons before any invasive procedure.",
            "⚠️ Avoid combining with Omeprazole as it may decrease Clopidogrel's antiplatelet efficacy; Pantoprazole is preferred if acid suppression is needed."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (75mg)"],
        "brand_equivalents": ["Clopilet 75", "Plavix", "Deplatt"]
    },
    "diclofenac": {
        "name": "Diclofenac",
        "aliases": ["voveran", "voltaren", "cataflam"],
        "category": "Potent NSAID Pain Reliever",
        "description": "Strong non-steroidal anti-inflammatory drug providing rapid relief from severe acute musculoskeletal and inflammatory pain.",
        "primary_uses": [
            "Acute backache, slip disc pain, and sciatica",
            "Osteoarthritis and rheumatoid arthritis pain flare-ups",
            "Severe dental pain and post-surgical pain",
            "Renal colic (kidney stone pain) and acute gout flares"
        ],
        "dosage_instructions": "Adults: 50mg two to three times daily, or 75mg sustained release (SR) once or twice daily.",
        "how_to_take": "MUST be taken with or immediately after food with plenty of water. Never take on an empty stomach.",
        "common_side_effects": ["Gastric irritation / acidity", "Nausea", "Headache"],
        "warnings": [
            "⚠️ Higher gastrointestinal and cardiovascular risk than paracetamol; use lowest effective dose for the shortest duration.",
            "⚠️ Contraindicated in active peptic ulcer disease, severe heart failure, or established ischemic heart disease.",
            "⚠️ Ensure adequate hydration to protect renal function."
        ],
        "prescription_required": True,
        "available_forms": ["Tablet (50mg, 75mg SR)", "Topical Gel (1%)", "Intramuscular Injection"],
        "brand_equivalents": ["Voveran 50", "Voltaren", "Cataflam"]
    }
}

# ---------------------------------------------------------------------------
# Symptom & Health Condition Mapping
# ---------------------------------------------------------------------------
SYMPTOM_MAP = [
    {
        "keywords": ["fever", "high temperature", "chills", "febrile", "pyrexia", "feeling hot"],
        "condition": "Fever & High Body Temperature",
        "overview": "Fever is the body's natural immunological response to infections (viral or bacterial). Resting and hydration are vital.",
        "first_line_medicines": ["Paracetamol (500mg/650mg)", "Dolo 650", "Crocin"],
        "alternative_medicines": ["Combiflam (if accompanied by severe body aches, take with food)"],
        "home_care": [
            "Stay well hydrated with electrolyte water, coconut water, or warm soups.",
            "Rest in a cool, ventilated room with light clothing.",
            "Use a damp lukewarm cloth for forehead sponge baths if fever exceeds 102°F (38.9°C)."
        ],
        "red_flags": "🚨 Seek immediate emergency medical care if fever exceeds 103°F (39.4°C), lasts > 3 days, or is accompanied by stiff neck, confusion, difficulty breathing, or rash."
    },
    {
        "keywords": ["headache", "head ache", "migraine", "head pain", "throbbing head"],
        "condition": "Headache & Migraine",
        "overview": "Headaches can stem from tension, dehydration, lack of sleep, eye strain, sinus congestion, or migraines.",
        "first_line_medicines": ["Paracetamol (650mg)", "Dolo 650", "Crocin"],
        "alternative_medicines": ["Combiflam or Ibuprofen 400mg (take with food for inflammatory/tension headaches)"],
        "home_care": [
            "Drink 500ml of water immediately (dehydration is a frequent cause).",
            "Rest in a quiet, dark room and apply a cold compress to forehead or temples.",
            "Avoid bright screens and loud noises."
        ],
        "red_flags": "🚨 Seek emergency care if headache is sudden and explosive ('thunderclap'), accompanied by speech difficulty, facial drooping, numbness, or high fever."
    },
    {
        "keywords": ["body pain", "back pain", "muscle ache", "joint pain", "sprain", "arthritis", "backache", "neck pain"],
        "condition": "Musculoskeletal & Joint Pain",
        "overview": "Pain in muscles, joints, or back caused by strain, arthritis, heavy lifting, or viral illness.",
        "first_line_medicines": ["Combiflam (Ibuprofen + Paracetamol)", "Ibuprofen (400mg)"],
        "alternative_medicines": ["Diclofenac (50mg)", "Paracetamol (650mg)"],
        "home_care": [
            "Rest the affected muscle and apply ice packs for acute injuries in the first 48 hours.",
            "Use warm compresses for chronic stiffness or muscle tension.",
            "Always take pain medications strictly with or after meals."
        ],
        "red_flags": "🚨 Consult a doctor if back pain is accompanied by loss of bowel/bladder control, leg weakness, or following a traumatic fall."
    },
    {
        "keywords": ["acidity", "acid reflux", "gerd", "heartburn", "stomach burn", "gas", "bloating", "gastric", "indigestion", "sour burp"],
        "condition": "Acidity, Heartburn & GERD",
        "overview": "Excessive stomach acid secretion or backflow of acid into the esophagus causing burning sensation in the chest or upper abdomen.",
        "first_line_medicines": ["Pantoprazole (40mg)", "Omeprazole (20mg)"],
        "alternative_medicines": ["Antacid oral suspensions (e.g. Gelusil, Digene) for rapid temporary relief"],
        "home_care": [
            "Take PPIs (Pantoprazole/Omeprazole) 30 to 60 minutes BEFORE breakfast on an empty stomach.",
            "Avoid spicy, greasy, deep-fried foods, citrus, caffeine, and carbonated beverages.",
            "Do not lie down for at least 2 hours after having dinner; elevate head of bed slightly."
        ],
        "red_flags": "🚨 WARNING: Crushing chest pain radiating to the left arm, jaw, or shoulder could be a heart attack, NOT acidity! Seek emergency care immediately."
    },
    {
        "keywords": ["cold", "runny nose", "sneezing", "allergy", "allergic rhinitis", "watery eyes", "hay fever", "hives", "itchy"],
        "condition": "Allergic Rhinitis, Cold & Hives",
        "overview": "Histamine-mediated reaction to allergens (pollen, dust, animal dander) or common viral rhinitis.",
        "first_line_medicines": ["Cetirizine (10mg)", "Montelukast (10mg for bronchial/nasal allergies)"],
        "alternative_medicines": ["Vitamin C (500mg) for immune support", "Saline nasal spray"],
        "home_care": [
            "Inhale steam with warm water to relieve nasal congestion.",
            "Drink warm honey-lemon water (for adults and children over 1 year).",
            "Cetirizine is best taken at night as it may cause mild drowsiness."
        ],
        "red_flags": "🚨 Emergency attention needed if experiencing facial swelling, lip or tongue swelling, or difficulty breathing (anaphylaxis)."
    },
    {
        "keywords": ["cough", "throat pain", "sore throat", "tonsil", "pharyngitis", "throat infection"],
        "condition": "Cough & Sore Throat",
        "overview": "Irritation of the pharynx or bronchial tubes from viral infection, post-nasal drip, or bacterial infection.",
        "first_line_medicines": ["Paracetamol (500mg) for throat pain and inflammation", "Cetirizine (if related to allergy/post-nasal drip)"],
        "alternative_medicines": ["Azithromycin (500mg) or Amoxicillin (500mg) ONLY if confirmed bacterial by doctor"],
        "home_care": [
            "Warm salt water gargles 3 to 4 times daily.",
            "Steam inhalation for chest congestion.",
            "Warm ginger tea with honey."
        ],
        "red_flags": "🚨 Seek medical attention if unable to swallow saliva, difficulty breathing, coughing up blood, or high fever with white patches on tonsils."
    },
    {
        "keywords": ["asthma", "wheezing", "breathless", "shortness of breath", "chest tight"],
        "condition": "Asthma & Bronchospasm",
        "overview": "Airway constriction causing wheezing and labored breathing.",
        "first_line_medicines": ["Salbutamol Inhaler (100mcg - 1 to 2 puffs for quick rescue relief)"],
        "alternative_medicines": ["Montelukast (10mg) for long-term daily maintenance"],
        "home_care": [
            "Sit upright and stay calm. Avoid lying flat during breathing difficulty.",
            "Remove yourself from any smoke, dust, or cold air triggers.",
            "Keep your rescue inhaler accessible at all times."
        ],
        "red_flags": "🚨 CRITICAL EMERGENCY: If 2 puffs of rescue inhaler do not relieve symptoms within 10 minutes, lips turn bluish, or struggling to speak in full sentences, dial 108/112 immediately."
    },
    {
        "keywords": ["diabetes", "high sugar", "glucose", "diabetic", "sugar level"],
        "condition": "Type 2 Diabetes & Glycemic Control",
        "overview": "Elevated blood glucose levels requiring lifestyle intervention and prescribed antidiabetic therapy.",
        "first_line_medicines": ["Metformin (500mg/1000mg with meals, under prescription)"],
        "alternative_medicines": ["Consult doctor for personalized dual-therapy or insulin"],
        "home_care": [
            "Always take Metformin with or immediately after food to avoid stomach upset.",
            "Monitor fasting and post-meal blood glucose regularly.",
            "Maintain a low-glycemic, fiber-rich diet and engage in 30 minutes of daily walking."
        ],
        "red_flags": "🚨 Watch for hypoglycemia (blood sugar < 70 mg/dL): shakiness, sweating, confusion, dizziness. Carry fast-acting glucose tablets or fruit juice."
    },
    {
        "keywords": ["blood pressure", "hypertension", "high bp", "bp high"],
        "condition": "High Blood Pressure (Hypertension)",
        "overview": "Persistently elevated blood pressure requiring consistent daily medication and sodium restriction.",
        "first_line_medicines": ["Amlodipine (5mg)", "Telmisartan (40mg)"],
        "alternative_medicines": ["Prescription combination therapy as advised by your physician"],
        "home_care": [
            "Never skip or stop blood pressure medications without doctor consultation.",
            "Restrict sodium (salt) intake in meals (< 2,000mg sodium daily).",
            "Monitor blood pressure at rest at consistent times of the day."
        ],
        "red_flags": "🚨 Hypertensive Crisis: Blood pressure > 180/120 with severe headache, blurry vision, chest pain, or shortness of breath requires immediate emergency ER care."
    }
]

# ---------------------------------------------------------------------------
# Platform Support & FAQ Knowledge
# ---------------------------------------------------------------------------
SUPPORT_TOPICS = {
    "how_it_works": {
        "title": "How MedFind Works",
        "content": (
            "**MedFind** connects you with nearby verified pharmacies to check medicine stock in real time:\n\n"
            "1. **🔍 Search Medicine**: Enter any medicine name or generic compound (e.g. 'Dolo 650', 'Amoxicillin').\n"
            "2. **📍 Live Proximity & Freshness**: View which pharmacies have it, their distance from your location, and how recently they updated inventory.\n"
            "3. **⭐ Smart Confidence Score**: Pharmacies are ranked using a multi-criteria algorithm prioritizing stock availability (40%), freshness of report (25%), distance (25%), and open status (10%).\n"
            "4. **⏱️ 30-Minute Hold Reservation**: Click 'Reserve' to put a hold on the medicine for 30 minutes while you travel to the pharmacy!"
        )
    },
    "freshness_scoring": {
        "title": "Understanding Freshness & Confidence Scores",
        "content": (
            "MedFind calculates a real-time **Confidence Score (0 - 100%)** so you never make an empty trip:\n\n"
            "- **🟢 Fresh (Updated < 30 mins ago)**: Highest confidence. Stock was confirmed recently by the pharmacy.\n"
            "- **🟡 Aging (Updated 30m - 12h ago)**: Medium confidence. Good likelihood of stock, but call ahead if low quantity.\n"
            "- **⚪ Stale (Updated > 12h ago)**: Lower confidence. We recommend calling the pharmacy to verify.\n\n"
            "**Stock Status Pills**:\n"
            "- 🟢 **In Stock**: More than 10 units available.\n"
            "- 🟡 **Low Stock**: 1 to 10 units left — reserve immediately.\n"
            "- 🔴 **Out of Stock**: 0 units."
        )
    },
    "reservation_help": {
        "title": "MedFind Reservation Guide",
        "content": (
            "**How MedFind Reservations Work**:\n\n"
            "- **Hold Duration**: When you reserve medicine, the pharmacy holds it for **30 minutes** from submission.\n"
            "- **Reservation Code**: You receive a unique reference code like `RES-000001`.\n"
            "- **Pickup Instructions**: Show this reservation code at the pharmacy counter to collect your medicine.\n"
            "- **Prescription**: For prescription medicines (marked with ℞), please carry a valid doctor's prescription.\n"
            "- **No Upfront Payment Required**: Pay directly at the pharmacy when collecting."
        )
    },
    "pharmacy_login": {
        "title": "Pharmacy Partner Portal & Login",
        "content": (
            "**Pharmacy Partner Support**:\n\n"
            "- **Access Portal**: Click **Pharmacy Login** in the top navigation bar (or visit `#/login`).\n"
            "- **Demo Login**: You can log in with partner pharmacy names such as `MedPlus Pharmacy`, `Apollo Pharmacy`, `Wellness Pharmacy` with password `demo123`.\n"
            "- **Real-time Stock Updates**: Once logged in, pharmacies can update inventory quantities, mark medicines out of stock, and confirm pending reservations.\n"
            "- **Join MedFind Network**: To register a new pharmacy, please submit a support ticket via this chat or email `partners@medfind.org`."
        )
    },
    "emergency_helplines": {
        "title": "National Emergency & Medical Helplines",
        "is_emergency": True,
        "content": (
            "🚨 **CRITICAL HEALTH EMERGENCY ASSISTANCE**:\n\n"
            "If someone is experiencing severe chest pain, shortness of breath, heavy bleeding, or unconsciousness, dial emergency services immediately:\n\n"
            "- 🚑 **National Ambulance Service**: **108** / **102**\n"
            "- 🚨 **Universal Emergency Helpline**: **112**\n"
            "- 🧪 **National Poison Information Centre**: **1800-116-117**\n"
            "- 🩸 **24x7 Blood Bank & Health Helpline**: **104**\n"
            "- 👩‍⚕️ **Women's Safety Helpline**: **1091**\n"
            "- 🧠 **Tele-MANAS Mental Health Support**: **14416**"
        )
    }
}

# ---------------------------------------------------------------------------
# Core Engine Matching & Search Logic
# ---------------------------------------------------------------------------

def normalize_text(text: str) -> str:
    """Normalize text for fuzzy matching."""
    return re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower()).strip()


def find_medicine_kb_entry(query: str):
    """Find matching medicine knowledge entry by name or alias."""
    q = normalize_text(query)
    if not q:
        return None

    # Exact key match
    if q in MEDICINES_KB:
        return MEDICINES_KB[q]

    # Check key containment or alias match
    for key, data in MEDICINES_KB.items():
        if key in q or q in key:
            return data
        for alias in data.get("aliases", []):
            if alias in q or q in alias:
                return data

    # Partial word match for common tokens
    tokens = [t for t in q.split() if len(t) >= 4]
    for token in tokens:
        for key, data in MEDICINES_KB.items():
            if token in key or any(token in a for a in data.get("aliases", [])):
                return data

    return None


def find_symptom_match(query: str):
    """Identify if query matches common health symptoms."""
    q = normalize_text(query)
    for entry in SYMPTOM_MAP:
        for kw in entry["keywords"]:
            if kw in q:
                return entry
    return None


def find_support_topic(query: str):
    """Identify platform support intent."""
    q = normalize_text(query)
    if any(k in q for k in ["how it work", "what is medfind", "how to use", "how medfind works", "features"]):
        return SUPPORT_TOPICS["how_it_works"]
    if any(k in q for k in ["freshness", "score", "confidence", "green dot", "yellow dot", "stale", "ranking"]):
        return SUPPORT_TOPICS["freshness_scoring"]
    if any(k in q for k in ["how to reserve", "reservation work", "cancel reservation", "pickup", "hold medicine"]):
        return SUPPORT_TOPICS["reservation_help"]
    if any(k in q for k in ["pharmacy login", "pharmacy register", "partner", "add pharmacy", "update stock", "pharmacy dashboard"]):
        return SUPPORT_TOPICS["pharmacy_login"]
    if any(k in q for k in ["emergency", "ambulance", "hospital", "poison", "helpline", "sos", "urgent call"]):
        return SUPPORT_TOPICS["emergency_helplines"]
    return None


def get_live_stock_for_medicine(db_conn, medicine_name: str, user_lat=20.2961, user_lon=85.8245):
    """
    Query the SQLite database for live stock across all pharmacies for a medicine.
    Returns list of pharmacy inventory dictionaries.
    """
    if not db_conn or not medicine_name:
        return []

    try:
        rows = db_conn.execute(
            """
            SELECT
                p.id          AS pharmacy_id,
                p.name        AS pharmacy,
                p.address,
                p.latitude,
                p.longitude,
                p.is_open,
                m.name        AS medicine,
                m.strength,
                m.form,
                i.quantity,
                i.last_updated
            FROM inventory i
            JOIN pharmacies p ON p.id = i.pharmacy_id
            JOIN medicines  m ON m.id = i.medicine_id
            WHERE LOWER(m.name) LIKE LOWER(?)
            ORDER BY i.quantity DESC
            """,
            (f"%{medicine_name}%",)
        ).fetchall()

        results = []
        for r in rows:
            # Calculate distance
            lat1, lon1 = user_lat, user_lon
            lat2, lon2 = r["latitude"], r["longitude"]
            import math
            R = 6371.0
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlam = math.radians(lon2 - lon1)
            a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
            dist = round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)

            # Minutes since update
            mins = 9999
            try:
                dt = datetime.strptime(r["last_updated"], "%Y-%m-%d %H:%M:%S")
                delta = datetime.now(timezone.utc).replace(tzinfo=None) - dt
                mins = max(0, int(delta.total_seconds() / 60))
            except Exception:
                pass

            stock_status = "in_stock" if r["quantity"] > 10 else ("low_stock" if r["quantity"] > 0 else "out_of_stock")
            freshness = "fresh" if mins < 30 else ("aging" if mins < 720 else "stale")

            results.append({
                "pharmacy_id": r["pharmacy_id"],
                "pharmacy": r["pharmacy"],
                "address": r["address"],
                "medicine": r["medicine"],
                "strength": r["strength"],
                "form": r["form"],
                "quantity": r["quantity"],
                "stock_status": stock_status,
                "freshness": freshness,
                "distance_km": dist,
                "is_open": bool(r["is_open"]),
                "last_updated_minutes": mins
            })

        results.sort(key=lambda x: (x["stock_status"] == "out_of_stock", x["distance_km"]))
        return results
    except Exception as e:
        print(f"Error querying live stock in chatbot: {e}")
        return []


def lookup_reservation_status(db_conn, code: str):
    """Lookup a reservation code like RES-000001 or 1."""
    if not db_conn:
        return None

    # Extract digits from string
    num_match = re.search(r'\d+', code)
    if not num_match:
        return None

    res_id = int(num_match.group(0))

    try:
        row = db_conn.execute(
            """
            SELECT
                r.id,
                r.pharmacy_id,
                r.medicine_name,
                r.quantity,
                r.status,
                r.created_at,
                p.name AS pharmacy_name,
                p.address AS pharmacy_address
            FROM reservations r
            JOIN pharmacies p ON p.id = r.pharmacy_id
            WHERE r.id = ?
            """,
            (res_id,)
        ).fetchone()

        if row:
            mins_ago = 0
            try:
                dt = datetime.strptime(row["created_at"], "%Y-%m-%d %H:%M:%S")
                delta = datetime.now(timezone.utc).replace(tzinfo=None) - dt
                mins_ago = max(0, int(delta.total_seconds() / 60))
            except Exception:
                pass

            remaining_mins = max(0, 30 - mins_ago)
            is_expired = remaining_mins == 0 and row["status"] == "pending"

            return {
                "id": row["id"],
                "code": f"RES-{row['id']:06d}",
                "pharmacy": row["pharmacy_name"],
                "address": row["pharmacy_address"],
                "medicine": row["medicine_name"],
                "quantity": row["quantity"],
                "status": "expired" if is_expired else row["status"],
                "created_at": row["created_at"],
                "minutes_ago": mins_ago,
                "remaining_minutes": remaining_mins
            }
    except Exception as e:
        print(f"Error looking up reservation in chatbot: {e}")
    return None


def lookup_order_status(db_conn, code: str):
    """Lookup an express delivery order code like MF-ORD-849201."""
    if not db_conn:
        return None
    match = re.search(r'MF-ORD-\d+', code, re.IGNORECASE)
    if not match:
        num_match = re.search(r'\d{5,7}', code)
        if num_match:
            order_code = f"MF-ORD-{num_match.group(0)}"
        else:
            return None
    else:
        order_code = match.group(0).upper()

    try:
        row = db_conn.execute("SELECT * FROM orders WHERE UPPER(order_code) = ?", (order_code,)).fetchone()
        if row:
            import json
            order = dict(row)
            try:
                order["items"] = json.loads(order["items_json"])
            except Exception:
                order["items"] = []
            return order
    except Exception as e:
        print(f"Error looking up order in chatbot: {e}")
    return None


def create_support_ticket(db_conn, user_name: str, contact: str, category: str, subject: str, message: str):
    """Create a new support ticket and return ticket code."""
    if not db_conn:
        return None

    ticket_code = f"TICK-{random.randint(100000, 999999)}"
    try:
        db_conn.execute(
            """
            INSERT INTO support_tickets (ticket_code, user_name, contact, category, subject, message, status)
            VALUES (?, ?, ?, ?, ?, ?, 'open')
            """,
            (ticket_code, user_name, contact, category, subject, message)
        )
        db_conn.commit()
        return ticket_code
    except Exception as e:
        print(f"Error inserting support ticket: {e}")
        return None


# ---------------------------------------------------------------------------
# Main Chatbot Processing Pipeline
# ---------------------------------------------------------------------------

def process_chat_message(user_message: str, user_lat=20.2961, user_lon=85.8245, db_conn=None):
    """
    Process incoming user message and generate a structured assistant response.
    Returns:
    {
        "reply": str,
        "type": "medicine_detail" | "stock_check" | "symptom_advice" | "reservation_status" | "support_ticket" | "support_info" | "general",
        "cards": list,
        "quick_replies": list
    }
    """
    raw_msg = (user_message or "").strip()
    msg = normalize_text(raw_msg)

    default_chips = [
        {"label": "💊 Medicine Details", "action": "Tell me about Dolo 650"},
        {"label": "🛵 Track Order", "action": "Track MF-ORD"},
        {"label": "📍 Check Nearby Stock", "action": "Where is Paracetamol in stock?"},
        {"label": "🔍 Symptom Help", "action": "What medicine is good for fever and headache?"},
        {"label": "📋 Track Reservation", "action": "Track my reservation status"},
        {"label": "🎫 Create Support Ticket", "action": "I want to raise a support ticket"},
        {"label": "🚨 Emergency Helplines", "action": "Show emergency contact helplines"}
    ]

    if not msg:
        return {
            "reply": "Hello! I am **MedBot**, your MedFind Health & Support Assistant. How can I help you today? You can ask about medicine usages, check real-time stock in nearby pharmacies, track delivery orders or reservations, or contact support.",
            "type": "general",
            "cards": [],
            "quick_replies": default_chips
        }

    # 1. Greetings
    if any(g == msg for g in ["hi", "hello", "hey", "hola", "namaste", "good morning", "good evening", "good afternoon"]):
        return {
            "reply": (
                "👋 **Hello! I'm MedBot**, your 24/7 MedFind Health & Support Assistant.\n\n"
                "I can assist you with:\n"
                "• **Medicine Details**: Uses, adult dosage, side effects, precautions & substitutes\n"
                "• **Live Pharmacy Stock**: Check which nearby pharmacies currently have your medicine\n"
                "• **Fast Delivery & Tracking**: Track your Swiggy/Blinkit-style 15-min medicine delivery\n"
                "• **Symptom Guidance**: Find recommended over-the-counter remedies for fever, acidity, pain, or cold\n"
                "• **Reservation Status**: Track your 30-minute hold order by ID\n"
                "• **Support System**: Raise a customer support ticket or connect with pharmacy partners\n\n"
                "What would you like to check today?"
            ),
            "type": "general",
            "cards": [],
            "quick_replies": default_chips
        }

    # 1.5 Express Delivery Order Tracking (Swiggy / Blinkit style e.g. "track MF-ORD-849201", "track order")
    if "mf-ord" in msg or (("order" in msg or "delivery" in msg) and ("track" in msg or "status" in msg or "where is" in msg) and re.search(r'\d+', msg)):
        order_info = lookup_order_status(db_conn, raw_msg)
        if order_info:
            status_labels = {
                "placed": "Order Placed",
                "preparing": "Pharmacist Packing Order",
                "out_for_delivery": "Out for Express Delivery",
                "delivered": "Delivered",
                "cancelled": "Cancelled"
            }
            status_name = status_labels.get(order_info.get("status"), order_info.get("status", "Confirmed"))
            otp_str = f" | Delivery OTP: {order_info.get('delivery_otp')}" if order_info.get('delivery_otp') and order_info.get('status') != 'delivered' else ""
            rider_str = f" • Rider: {order_info.get('rider_name')} ({order_info.get('rider_phone')})" if order_info.get('rider_name') else ""

            return {
                "reply": f"🛵 **Live Order Status: {order_info['order_code']}**\n\nStatus: **{status_name}**{otp_str}{rider_str}\nPharmacy: **{order_info.get('pharmacy_name')}**\nTotal: **₹{order_info.get('total_amount', 0):.0f}**",
                "type": "order_tracking",
                "cards": [{
                    "card_type": "order_tracking_card",
                    "order_code": order_info["order_code"],
                    "status": order_info.get("status"),
                    "status_label": status_name,
                    "pharmacy": order_info.get("pharmacy_name"),
                    "items": order_info.get("items", []),
                    "total": order_info.get("total_amount", 0),
                    "delivery_type": order_info.get("delivery_type"),
                    "otp": order_info.get("delivery_otp"),
                    "rider_name": order_info.get("rider_name"),
                    "rider_phone": order_info.get("rider_phone"),
                    "eta_minutes": order_info.get("eta_minutes", 15)
                }],
                "quick_replies": [
                    {"label": "📍 Track on Live Map", "action": f"Track order {order_info['order_code']}"},
                    {"label": "📦 View All My Orders", "action": "Show my orders"},
                    {"label": "💊 Check Medicine Stock", "action": "Where is Paracetamol in stock?"}
                ]
            }
        elif "mf-ord" in msg:
            return {
                "reply": "I couldn't locate that MedFind delivery order. Please check the order code (example: **MF-ORD-849201**). You can also click **'My Orders'** in the top navigation bar to see your full order history.",
                "type": "general",
                "cards": [],
                "quick_replies": [
                    {"label": "🔍 Search Medicines", "action": "Search Paracetamol"},
                    {"label": "📋 Track Reservation", "action": "Track my reservation status"}
                ]
            }

    # 2. Reservation Status Lookup (e.g., "track RES-000001", "status of reservation", "RES-000001")
    if "res-" in msg or (("reservation" in msg or "hold" in msg) and re.search(r'\d+', msg)):
        res_info = lookup_reservation_status(db_conn, raw_msg)
        if res_info:
            status_badge = "🟢 CONFIRMED" if res_info["status"] == "confirmed" else ("🟡 PENDING" if res_info["status"] == "pending" else "🔴 EXPIRED")
            time_msg = f"⏳ **{res_info['remaining_minutes']} minutes remaining** to collect your medicine." if res_info["remaining_minutes"] > 0 and res_info["status"] == "pending" else "⚠️ Hold window expired. Please place a new reservation or call pharmacy."
            return {
                "reply": f"Here are the details for your reservation **{res_info['code']}**:",
                "type": "reservation_status",
                "cards": [{
                    "card_type": "reservation_card",
                    "code": res_info["code"],
                    "pharmacy": res_info["pharmacy"],
                    "address": res_info["address"],
                    "medicine": res_info["medicine"],
                    "quantity": res_info["quantity"],
                    "status": res_info["status"],
                    "status_badge": status_badge,
                    "created_at": res_info["created_at"],
                    "minutes_ago": res_info["minutes_ago"],
                    "remaining_minutes": res_info["remaining_minutes"],
                    "time_msg": time_msg
                }],
                "quick_replies": [
                    {"label": "🔍 Find Other Pharmacies", "action": f"Where is {res_info['medicine']} in stock?"},
                    {"label": "🎫 Report Issue With Order", "action": f"Issue with reservation {res_info['code']}"},
                    {"label": "❓ How Do Reservations Work?", "action": "How do reservations work?"}
                ]
            }
        else:
            return {
                "reply": "I couldn't locate that reservation reference. Please ensure you provide the code in the format **RES-000001** (or simply the numeric ID). You can find this on your reservation confirmation receipt.",
                "type": "general",
                "cards": [],
                "quick_replies": [
                    {"label": "❓ How Reservations Work", "action": "How do reservations work?"},
                    {"label": "🎫 Contact Support", "action": "I need help with my reservation"}
                ]
            }

    # Generic reservation inquiry prompt
    if ("track" in msg or "status" in msg or "check" in msg) and "reservation" in msg and not re.search(r'\d+', msg):
        return {
            "reply": "To check your reservation, please type your Reservation Code (for example: **RES-000001**). When you reserve medicine on MedFind, a 6-digit code is generated to hold stock for 30 minutes.",
            "type": "general",
            "cards": [],
            "quick_replies": [
                {"label": "🔍 Search Medicines", "action": "Search Paracetamol"},
                {"label": "🎫 Contact Support", "action": "I need help with my reservation"}
            ]
        }

    # 3. Emergency / SOS
    if any(k in msg for k in ["emergency", "ambulance", "hospital", "poison", "sos", "urgent helpline"]):
        topic = SUPPORT_TOPICS["emergency_helplines"]
        return {
            "reply": topic["content"],
            "type": "support_info",
            "cards": [{
                "card_type": "emergency_card",
                "title": "🚨 Emergency Helplines",
                "contacts": [
                    {"label": "Ambulance / Medical Emergency", "number": "108", "tel": "tel:108"},
                    {"label": "National Emergency Helpline", "number": "112", "tel": "tel:112"},
                    {"label": "National Poison Info Centre", "number": "1800-116-117", "tel": "tel:1800116117"},
                    {"label": "24x7 Blood Bank & Health Desk", "number": "104", "tel": "tel:104"}
                ]
            }],
            "quick_replies": [
                {"label": "💊 Medicine Uses", "action": "Tell me about Paracetamol"},
                {"label": "❓ How MedFind Works", "action": "How does MedFind work?"}
            ]
        }

    # 4. Support Ticket Request Flow
    if any(k in msg for k in ["support ticket", "raise ticket", "report issue", "complaint", "wrong stock", "contact support", "talk to human", "agent"]):
        return {
            "reply": (
                "📝 **MedFind Support Center**\n\n"
                "I can register an official support ticket for you directly! Our customer operations team responds within 2 hours.\n\n"
                "Please click **'Raise Support Ticket'** below to provide details, or choose an issue category:"
            ),
            "type": "support_ticket_prompt",
            "cards": [{
                "card_type": "ticket_form_card",
                "title": "Open a MedFind Support Ticket",
                "categories": [
                    "Stock Discrepancy (Pharmacy had no stock)",
                    "Reservation Issue (Hold not honored)",
                    "Pharmacy Partner Registration",
                    "Website / App Technical Bug",
                    "General Medical / Feedback"
                ]
            }],
            "quick_replies": [
                {"label": "⚠️ Report Wrong Stock", "action": "Report stock discrepancy at pharmacy"},
                {"label": "⏱️ Reservation Problem", "action": "Problem with my reservation hold"},
                {"label": "🏥 Pharmacy Onboarding", "action": "How can my pharmacy partner with MedFind?"},
                {"label": "❓ Help & FAQs", "action": "How does MedFind work?"}
            ]
        }

    # 5. Direct Stock Inquiry across pharmacies (e.g. "Where is Dolo 650 available?", "Find Paracetamol near me", "Stock of Metformin")
    is_stock_query = any(k in msg for k in ["stock", "available", "where to buy", "find near", "pharmacy has", "where is", "can i get"])
    med_kb = find_medicine_kb_entry(raw_msg)

    if med_kb and (is_stock_query or "near me" in msg or "in stock" in msg):
        stock_list = get_live_stock_for_medicine(db_conn, med_kb["name"], user_lat, user_lon)
        in_stock_count = sum(1 for s in stock_list if s["stock_status"] != "out_of_stock")

        reply_intro = f"🔍 Live stock check for **{med_kb['name']}** near you:\nFound **{in_stock_count} pharmacies** with available stock."
        return {
            "reply": reply_intro,
            "type": "stock_check",
            "cards": [{
                "card_type": "stock_results_card",
                "medicine_name": med_kb["name"],
                "category": med_kb["category"],
                "items": stock_list[:5]  # Top 5 closest / best stocked
            }],
            "quick_replies": [
                {"label": f"📖 Read {med_kb['name']} Uses & Dosage", "action": f"Tell me more about {med_kb['name']}"},
                {"label": "🔄 Check Another Medicine", "action": "Where is Combiflam in stock?"},
                {"label": "📋 Track Reservation", "action": "Track my reservation status"}
            ]
        }

    # 6. Detailed Medicine Information (e.g. "Tell me about Paracetamol", "What is Dolo 650 used for?", "Combiflam dosage", "Side effects of Cetirizine")
    if med_kb:
        # Also grab live stock summary for this medicine so user gets both details AND instant local availability!
        stock_list = get_live_stock_for_medicine(db_conn, med_kb["name"], user_lat, user_lon)
        available_pharmacies = [s for s in stock_list if s["stock_status"] != "out_of_stock"]

        stock_summary_text = (
            f"🟢 **Available right now at {len(available_pharmacies)} nearby pharmacies!**"
            if available_pharmacies else
            "🔴 Currently out of stock at immediate nearby pharmacies, but check back soon or try equivalent substitutes."
        )

        return {
            "reply": f"Here are comprehensive medical details and live availability for **{med_kb['name']}**:",
            "type": "medicine_detail",
            "cards": [{
                "card_type": "medicine_detail_card",
                "name": med_kb["name"],
                "category": med_kb["category"],
                "description": med_kb["description"],
                "prescription_required": med_kb["prescription_required"],
                "primary_uses": med_kb["primary_uses"],
                "dosage_instructions": med_kb["dosage_instructions"],
                "how_to_take": med_kb["how_to_take"],
                "common_side_effects": med_kb["common_side_effects"],
                "warnings": med_kb["warnings"],
                "available_forms": med_kb.get("available_forms", []),
                "brand_equivalents": med_kb.get("brand_equivalents", []),
                "stock_summary": stock_summary_text,
                "nearby_stock": stock_list[:3]  # Include top 3 pharmacies directly in the card!
            }],
            "quick_replies": [
                {"label": f"📍 Check All Pharmacies for {med_kb['name']}", "action": f"Where is {med_kb['name']} in stock?"},
                {"label": "⚠️ Common Side Effects", "action": f"Side effects of {med_kb['name']}"},
                {"label": "🔄 Generic Substitutes", "action": f"What are substitutes for {med_kb['name']}?"},
                {"label": "🔍 Find Other Medicine", "action": "Tell me about Combiflam"}
            ]
        }

    # 7. Symptom / Condition Matching (e.g. "I have fever and headache", "medicine for acidity", "body pain relief")
    symptom_data = find_symptom_match(raw_msg)
    if symptom_data:
        return {
            "reply": f"🩺 **Guidance for {symptom_data['condition']}**:\n\n{symptom_data['overview']}",
            "type": "symptom_advice",
            "cards": [{
                "card_type": "symptom_advice_card",
                "condition": symptom_data["condition"],
                "first_line": symptom_data["first_line_medicines"],
                "alternatives": symptom_data["alternative_medicines"],
                "home_care": symptom_data["home_care"],
                "red_flags": symptom_data["red_flags"]
            }],
            "quick_replies": [
                {"label": f"📍 Check Stock for {symptom_data['first_line_medicines'][0].split()[0]}", "action": f"Where is {symptom_data['first_line_medicines'][0].split()[0]} in stock?"},
                {"label": "📖 Medicine Details", "action": f"Tell me about {symptom_data['first_line_medicines'][0].split()[0]}"},
                {"label": "🚨 Emergency Helplines", "action": "Show emergency contact helplines"}
            ]
        }

    # 8. Platform Support Topics & FAQs
    support_topic = find_support_topic(raw_msg)
    if support_topic:
        return {
            "reply": support_topic["content"],
            "type": "support_info",
            "cards": [],
            "quick_replies": [
                {"label": "🔍 Search Medicines", "action": "Search Paracetamol"},
                {"label": "📋 Track Reservation", "action": "Track my reservation status"},
                {"label": "🎫 Raise Support Ticket", "action": "I want to raise a support ticket"},
                {"label": "🚨 Emergency Helplines", "action": "Show emergency contact helplines"}
            ]
        }

    # 9. Fallback & Smart Discovery
    # Let's check if any word might match medicines in the SQLite database
    if db_conn:
        try:
            tokens = [t for t in msg.split() if len(t) >= 4]
            for token in tokens:
                row = db_conn.execute("SELECT DISTINCT name FROM medicines WHERE LOWER(name) LIKE ? LIMIT 1", (f"%{token}%",)).fetchone()
                if row:
                    med_name = row[0]
                    # We found a medicine in the DB!
                    stock_list = get_live_stock_for_medicine(db_conn, med_name, user_lat, user_lon)
                    return {
                        "reply": f"I found **{med_name}** in the MedFind catalog! Here is live stock availability across nearby pharmacies:",
                        "type": "stock_check",
                        "cards": [{
                            "card_type": "stock_results_card",
                            "medicine_name": med_name,
                            "category": "Pharmacy Catalog Medicine",
                            "items": stock_list[:5]
                        }],
                        "quick_replies": [
                            {"label": f"📖 Information for {med_name}", "action": f"Tell me about {med_name}"},
                            {"label": "🔍 Search Other Medicine", "action": "Where is Dolo 650 in stock?"},
                            {"label": "❓ Help & FAQs", "action": "How does MedFind work?"}
                        ]
                    }
        except Exception:
            pass

    # Default Helpful Response
    return {
        "reply": (
            "I'm here to help with medicine details, pharmacy stock availability, and MedFind customer support!\n\n"
            "You can try asking:\n"
            "• **'Tell me about [Medicine]'** (e.g., Paracetamol, Dolo 650, Metformin, Azithromycin, Combiflam)\n"
            "• **'Where is [Medicine] in stock?'** to check real-time availability in nearby pharmacies\n"
            "• **'What medicine helps with [symptom]?'** (e.g., fever, headache, acidity, allergy, body pain)\n"
            "• **'Track RES-000001'** to check your 30-minute reservation status\n"
            "• **'Raise support ticket'** to submit an inquiry to our support desk"
        ),
        "type": "general",
        "cards": [],
        "quick_replies": default_chips
    }
