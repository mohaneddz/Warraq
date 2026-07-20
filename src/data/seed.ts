import { database } from "./database";

const id = () => crypto.randomUUID() as string;

function randomDateBetween(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

export function generateMedicalCoverSvg(
  title: string,
  author: string,
  category: string,
  subtitle?: string,
  primaryColor = "#0f766e",
  secondaryColor = "#042f2e",
  accentColor = "#34d399"
): string {
  const safeXml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const sTitle = safeXml(title);
  const sAuthor = safeXml(author);
  const sCategory = safeXml(category.toUpperCase());
  const sSubtitle = subtitle ? safeXml(subtitle) : "";

  const words = sTitle.split(" ");
  let l1 = "", l2 = "", l3 = "";
  if (words.length <= 3) {
    l1 = sTitle;
  } else if (words.length <= 6) {
    l1 = words.slice(0, Math.ceil(words.length / 2)).join(" ");
    l2 = words.slice(Math.ceil(words.length / 2)).join(" ");
  } else {
    l1 = words.slice(0, 3).join(" ");
    l2 = words.slice(3, 7).join(" ");
    l3 = words.slice(7).join(" ");
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 510" width="340" height="510">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="65%" stop-color="${secondaryColor}"/>
      <stop offset="100%" stop-color="#05140f"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentColor}"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  
  <rect x="0" y="0" width="14" height="100%" fill="#000000" opacity="0.25"/>
  <rect x="14" y="0" width="2" height="100%" fill="#ffffff" opacity="0.1"/>

  <rect x="24" y="24" width="292" height="462" rx="10" fill="none" stroke="${accentColor}" stroke-width="1.5" stroke-opacity="0.35"/>
  
  <rect x="36" y="44" width="70" height="4" rx="2" fill="url(#accent)"/>
  <text x="36" y="66" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="${accentColor}" letter-spacing="2.5">${sCategory}</text>
  
  <g transform="translate(265, 62)">
    <circle cx="0" cy="0" r="20" fill="${accentColor}" fill-opacity="0.12" stroke="${accentColor}" stroke-width="1.5"/>
    <path d="M-7 0 H7 M0 -7 V7" stroke="${accentColor}" stroke-width="3" stroke-linecap="round"/>
  </g>

  <text x="36" y="150" font-family="'Segoe UI', Roboto, 'Helvetica Neue', sans-serif" font-size="21" font-weight="800" fill="#ffffff" letter-spacing="-0.3">
    <tspan x="36" dy="0">${l1}</tspan>
    ${l2 ? `<tspan x="36" dy="28">${l2}</tspan>` : ""}
    ${l3 ? `<tspan x="36" dy="28">${l3}</tspan>` : ""}
  </text>

  ${sSubtitle ? `<text x="36" y="${l3 ? 260 : l2 ? 232 : 204}" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="${accentColor}" opacity="0.9">${sSubtitle}</text>` : ""}

  <line x1="36" y1="310" x2="140" y2="310" stroke="${accentColor}" stroke-width="3" stroke-linecap="round"/>

  <text x="36" y="348" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#f1f5f9">${sAuthor}</text>
  <text x="36" y="368" font-family="system-ui, sans-serif" font-size="10" fill="#94a3b8" font-weight="500">Standard Medical Reference &amp; Clinical Edition</text>

  <rect x="36" y="426" width="268" height="34" rx="8" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.1"/>
  <text x="52" y="447" font-family="monospace" font-size="10" fill="${accentColor}" font-weight="700" letter-spacing="1.5">WARRAQ MEDICAL LIBRARY</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const medicalBooksData = [
  {
    title: "Harrison's Principles of Internal Medicine",
    subtitle: "21st Edition - Clinical & Pathophysiological Reference",
    author: "J. Larry Jameson, Anthony Fauci, Dennis Kasper, Stephen Hauser, Dan Longo, Joseph Loscalzo",
    publisher: "McGraw Hill / Medical",
    category: "Internal Medicine",
    isbn: "978-1259644030",
    lang: "en",
    year: 2022,
    call_number: "WB 115 H318 2022",
    description: "The landmark internal medicine reference text providing authoritative guidance on disease pathophysiology, clinical diagnosis, and evidence-based patient treatment strategies.",
    colors: { primary: "#064e3b", secondary: "#022c22", accent: "#34d399" }
  },
  {
    title: "Gray's Anatomy",
    subtitle: "42nd Edition - Anatomical Basis of Clinical Practice",
    author: "Susan Standring",
    publisher: "Elsevier",
    category: "Anatomy",
    isbn: "978-0702077050",
    lang: "en",
    year: 2020,
    call_number: "QS 4 G781 2020",
    description: "The definitive human anatomy reference, offering unrivaled anatomical precision, clinical correlations, and state-of-the-art diagnostic imaging cross-sections.",
    colors: { primary: "#1e3a8a", secondary: "#0f172a", accent: "#60a5fa" }
  },
  {
    title: "Robbins & Cotran Pathologic Basis of Disease",
    subtitle: "10th Edition - Core Pathology Textbook",
    author: "Vinay Kumar, Abul K. Abbas, Jon C. Aster",
    publisher: "Elsevier",
    category: "Pathology",
    isbn: "978-0323531139",
    lang: "en",
    year: 2020,
    call_number: "QZ 4 R632 2020",
    description: "Complete and readable coverage of general pathology principles and systemic organ pathology, essential for medical students and pathology residents.",
    colors: { primary: "#881337", secondary: "#4c0519", accent: "#fb7185" }
  },
  {
    title: "Netter's Atlas of Human Anatomy",
    subtitle: "8th Edition - Classic Clinical Anatomical Illustrations",
    author: "Frank H. Netter",
    publisher: "Elsevier",
    category: "Anatomy",
    isbn: "978-0323393225",
    lang: "en",
    year: 2022,
    call_number: "QS 17 N477a 2022",
    description: "World-renowned hand-painted anatomical atlas emphasizing clinical perspectives with clear, beautifully detailed visual depictions of human structure.",
    colors: { primary: "#164e63", secondary: "#083344", accent: "#22d3ee" }
  },
  {
    title: "Guyton and Hall Textbook of Medical Physiology",
    subtitle: "14th Edition - Fundamental Human Physiology",
    author: "John E. Hall, Michael E. Hall",
    publisher: "Elsevier",
    category: "Physiology",
    isbn: "978-0323597128",
    lang: "en",
    year: 2020,
    call_number: "QT 104 G992t 2020",
    description: "Focuses on core physiological principles necessary for understanding how human body organs work together to maintain homeostasis in health and disease.",
    colors: { primary: "#581c87", secondary: "#3b0764", accent: "#c084fc" }
  },
  {
    title: "Goodman & Gilman's Pharmacological Basis of Therapeutics",
    subtitle: "14th Edition - Blue Bible of Pharmacology",
    author: "Laurence L. Brunton, Björn C. Knollmann",
    publisher: "McGraw Hill",
    category: "Pharmacology",
    isbn: "978-1264258079",
    lang: "en",
    year: 2022,
    call_number: "QV 4 G653 2022",
    description: "The premier reference manual on drug action mechanisms, pharmacokinetics, molecular therapeutic targets, and clinical pharmacology.",
    colors: { primary: "#115e59", secondary: "#042f2e", accent: "#2dd4bf" }
  },
  {
    title: "Nelson Textbook of Pediatrics",
    subtitle: "21st Edition - Comprehensive Child Healthcare Guide",
    author: "Robert M. Kliegman, Joseph St. Geme",
    publisher: "Elsevier",
    category: "Pediatrics",
    isbn: "978-0323529501",
    lang: "en",
    year: 2019,
    call_number: "WS 100 N424 2019",
    description: "The primary reference source for pediatricians, covering neonatal care, childhood development, pediatric disease prevention, and acute pediatric interventions.",
    colors: { primary: "#1d4ed8", secondary: "#1e1b4b", accent: "#93c5fd" }
  },
  {
    title: "Sabiston Textbook of Surgery",
    subtitle: "21st Edition - Biological Basis of Modern Surgical Practice",
    author: "Courtney M. Townsend, R. Daniel Beauchamp, B. Mark Evers",
    publisher: "Elsevier",
    category: "Surgery",
    isbn: "978-0323640626",
    lang: "en",
    year: 2021,
    call_number: "WO 100 S117t 2021",
    description: "Authoritative surgical guide detailing fundamental principles of wound healing, surgical oncology, organ systems surgery, and trauma management.",
    colors: { primary: "#334155", secondary: "#0f172a", accent: "#38bdf8" }
  },
  {
    title: "Braunwald's Heart Disease",
    subtitle: "12th Edition - Textbook of Cardiovascular Medicine",
    author: "Peter Libby, Robert O. Bonow, Douglas L. Mann",
    publisher: "Elsevier",
    category: "Cardiology",
    isbn: "978-0323722179",
    lang: "en",
    year: 2021,
    call_number: "WG 210 B825h 2021",
    description: "The premier cardiovascular medicine reference covering ischemic heart disease, heart failure, arrhythmias, valve disease, and molecular cardiology.",
    colors: { primary: "#9f1239", secondary: "#4c0519", accent: "#f43f5e" }
  },
  {
    title: "Adams and Victor's Principles of Neurology",
    subtitle: "11th Edition - Clinical Neurology Reference",
    author: "Allan H. Ropper, Martin A. Samuels, Joshua P. Klein",
    publisher: "McGraw Hill",
    category: "Neurology",
    isbn: "978-0071842617",
    lang: "en",
    year: 2019,
    call_number: "WL 100 A211p 2019",
    description: "Detailed clinical textbook explaining central and peripheral nervous system disorders, neuroimaging evaluation, stroke management, and neuro-oncology.",
    colors: { primary: "#3730a3", secondary: "#1e1b4b", accent: "#818cf8" }
  },
  {
    title: "Williams Obstetrics",
    subtitle: "26th Edition - Maternal-Fetal Medicine & Delivery Guide",
    author: "F. Gary Cunningham, Kenneth J. Leveno, Steven L. Bloom",
    publisher: "McGraw Hill",
    category: "Obstetrics & Gynecology",
    isbn: "978-1260462739",
    lang: "en",
    year: 2022,
    call_number: "WQ 100 W721 2022",
    description: "The world's leading obstetrics textbook detailing prenatal care, labor physiology, high-risk pregnancy management, and obstetric surgery.",
    colors: { primary: "#701a75", secondary: "#4a044e", accent: "#f0abfc" }
  },
  {
    title: "Tintinalli's Emergency Medicine",
    subtitle: "9th Edition - Comprehensive Emergency Care Manual",
    author: "Judith E. Tintinalli, O. John Ma, Donald M. Yealy",
    publisher: "McGraw Hill",
    category: "Emergency Medicine",
    isbn: "978-1260019933",
    lang: "en",
    year: 2019,
    call_number: "WB 105 T593e 2019",
    description: "Essential emergency department reference covering resuscitation, trauma, toxicology, acute cardiac events, and critical care procedures.",
    colors: { primary: "#9a3412", secondary: "#431407", accent: "#fb923c" }
  },
  {
    title: "Stahl's Essential Psychopharmacology",
    subtitle: "5th Edition - Neuroscientific Basis & Practical Applications",
    author: "Stephen M. Stahl",
    publisher: "Cambridge University Press",
    category: "Psychiatry",
    isbn: "978-1108838573",
    lang: "en",
    year: 2021,
    call_number: "WM 100 S781e 2021",
    description: "Clear and visual breakdown of psychiatric drug mechanisms, neurotransmitter pathways, and clinical psychopharmacotherapeutic choices.",
    colors: { primary: "#4c1d95", secondary: "#2e1065", accent: "#a78bfa" }
  },
  {
    title: "Sherris Medical Microbiology",
    subtitle: "8th Edition - Pathogens & Infectious Diseases",
    author: "Kenneth J. Ryan",
    publisher: "McGraw Hill",
    category: "Microbiology",
    isbn: "978-1260464283",
    lang: "en",
    year: 2022,
    call_number: "QW 4 S553m 2022",
    description: "Comprehensive guide to bacteriology, virology, mycology, parasitology, and hospital-acquired infection controls.",
    colors: { primary: "#14532d", secondary: "#052e16", accent: "#4ade80" }
  },
  {
    title: "Janeway's Immunobiology",
    subtitle: "10th Edition - Cellular & Molecular Immunology",
    author: "Kenneth Murphy, Casey Weaver",
    publisher: "WW Norton & Co",
    category: "Immunology",
    isbn: "978-0815345053",
    lang: "en",
    year: 2022,
    call_number: "QW 504 J33i 2022",
    description: "Unifying introduction to innate and adaptive immune responses, antigen recognition, lymphocyte development, and immunopathology.",
    colors: { primary: "#365314", secondary: "#1a2e05", accent: "#84cc16" }
  },
  {
    title: "طب الأندلس",
    subtitle: "كتاب التيسير في مداواة وتدبير الأغذية والأدوية",
    arabic_title: "طب الأندلس - كتاب التيسير",
    author: "ابن زهر الأندلسي",
    publisher: "دار المعارف",
    category: "History of Medicine",
    isbn: "978-2123456789",
    lang: "ar",
    year: 1162,
    call_number: "WZ 294 I13t 1162",
    description: "دراسة طبية سريرية فريدة للطبيب الأندلسي العظيم ابن زهر تناولت الأمراض والأغذية والأدوية المفردة والمركبة بكفاءة عالية.",
    colors: { primary: "#064e3b", secondary: "#022c22", accent: "#fbbf24" }
  },
  {
    title: "القانون في الطب",
    subtitle: "الموسوعة الطبية الكبرى في العصور الوسطى",
    arabic_title: "القانون في الطب - الشيخ الرئيس ابن سينا",
    author: "ابن سينا (Avicenna)",
    publisher: "دار الكتب العلمية",
    category: "Classical Medicine",
    isbn: "978-9953270123",
    lang: "ar",
    year: 1025,
    call_number: "WZ 294 I12k 1025",
    description: "أعظم موسوعة طبية تاريخية حوت خُمس علوم الطب في العصور المزدهرة وكان المرجع الأساسي لمدرسة مونبلييه وجامعات أوروبا لمئات السنين.",
    colors: { primary: "#0f766e", secondary: "#042f2e", accent: "#f59e0b" }
  },
  {
    title: "الحاوي في الطب",
    subtitle: "الموسوعة التشخيصية والعلاجية السريرية",
    arabic_title: "الحاوي في الطب - أبا بكر الرازي",
    author: "أبو بكر الرازي (Rhazes)",
    publisher: "مطبوعات دار الهلال",
    category: "Clinical Medicine",
    isbn: "978-9953456120",
    lang: "ar",
    year: 925,
    call_number: "WZ 294 R436h 925",
    description: "أضخم كتاب طبي سريري سجل فيه الرازي ملاحظاته الميدانية ودراسات الحالات المرضية وتجاربه الإكلينيكية في البيمارستان.",
    colors: { primary: "#134e4a", secondary: "#062c26", accent: "#34d399" }
  },
  {
    title: "التصريف لمن عجز عن التأليف",
    subtitle: "الموسوعة الجراحية الأولى والمبتكرات الجراحية",
    arabic_title: "التصريف لمن عجز عن التأليف - الزهراوي",
    author: "أبو القاسم الزهراوي (Albucasis)",
    publisher: "المؤسسة الوطنية للكتاب",
    category: "Surgery",
    isbn: "978-9953880015",
    lang: "ar",
    year: 1000,
    call_number: "WZ 294 Z68t 1000",
    description: "أول موسوعة جراحية مصورة في تاريخ البشرية اشتملت على أكثر من مائتي أداة جراحية ابتكرها أبو القاسم الزهراوي في قرطبة.",
    colors: { primary: "#701a75", secondary: "#3b0764", accent: "#f43f5e" }
  },
  {
    title: "القاموس الطبي الموحد",
    subtitle: "معجم المصطلحات الطبية المعاصرة (عربي - إنجليزي - فرنسي)",
    arabic_title: "القاموس الطبي الموحد - منظمة الصحة العالمية",
    author: "منظمة الصحة العالمية وإتحاد الأطباء العرب",
    publisher: "منظمة الصحة العالمية",
    category: "Medical Dictionaries",
    isbn: "978-9290216706",
    lang: "ar",
    year: 2009,
    call_number: "W 13 Q15 2009",
    description: "القاموس الطبي الموحد المعترف به دولياً لتوحيد المصطلحات والمفاهيم الطبية بين اللغات العربية والإنجليزية والفرنسية.",
    colors: { primary: "#0369a1", secondary: "#0c4a6e", accent: "#38bdf8" }
  },
  {
    title: "Oxford Handbook of Clinical Medicine",
    subtitle: "10th Edition - Essential Pocket Clinical Guide",
    author: "Ian B. Wilkinson, Tim Raine, Kate Wiles",
    publisher: "Oxford University Press",
    category: "Clinical Medicine",
    isbn: "978-0199689903",
    lang: "en",
    year: 2017,
    call_number: "WB 39 O98h 2017",
    description: "The essential ward companion for junior medical staff, providing rapid access to bedside advice, differential diagnoses, and management plans.",
    colors: { primary: "#1e3a8a", secondary: "#0f172a", accent: "#facc15" }
  },
  {
    title: "Kumar and Clark's Clinical Medicine",
    subtitle: "10th Edition - Internal Medicine Companion",
    author: "Adam Feather, David Randall, Michael Waterhouse",
    publisher: "Elsevier",
    category: "Internal Medicine",
    isbn: "978-0702078682",
    lang: "en",
    year: 2020,
    call_number: "WB 100 K95c 2020",
    description: "Highly regarded textbook providing clear explanation of complex medical conditions, pathophysiology, and multidisciplinary clinical care.",
    colors: { primary: "#047857", secondary: "#022c22", accent: "#6ee7b7" }
  },
  {
    title: "Speroff's Clinical Gynecologic Endocrinology",
    subtitle: "9th Edition - Reproductive Endocrinology Guide",
    author: "Hugh S. Taylor, Lubna Pal, Emre Seli",
    publisher: "Lippincott Williams & Wilkins",
    category: "Endocrinology",
    isbn: "978-1451191363",
    lang: "en",
    year: 2019,
    call_number: "WP 520 S749c 2019",
    description: "Comprehensive source on reproductive physiology, hormonal therapies, contraception, menopause, and assisted reproductive technologies.",
    colors: { primary: "#be123c", secondary: "#4c0519", accent: "#fda4af" }
  },
  {
    title: "Schwartz's Principles of Surgery",
    subtitle: "11th Edition - Surgical Standard Reference",
    author: "F. Charles Brunicardi, Dana K. Andersen",
    publisher: "McGraw Hill",
    category: "Surgery",
    isbn: "978-1259642289",
    lang: "en",
    year: 2019,
    call_number: "WO 100 S399p 2019",
    description: "Comprehensive surgical resource covering core foundational principles, surgical pathophysiology, operative strategies, and trauma intensive care.",
    colors: { primary: "#1e293b", secondary: "#0f172a", accent: "#38bdf8" }
  },
  {
    title: "Lippincott Illustrated Reviews: Biochemistry",
    subtitle: "8th Edition - Visual Medical Biochemistry",
    author: "Emine E. Abali, Susan D. Cline, David S. Franklin",
    publisher: "Lippincott Williams & Wilkins",
    category: "Biochemistry",
    isbn: "978-1975155063",
    lang: "en",
    year: 2021,
    call_number: "QU 4 L766b 2021",
    description: "First-and-best resource for learning essential biochemistry, featuring visual metabolic maps, clinical integration, and USMLE preparation.",
    colors: { primary: "#4338ca", secondary: "#1e1b4b", accent: "#a5b4fc" }
  },
  {
    title: "Rang & Dale's Pharmacology",
    subtitle: "9th Edition - Mechanisms of Drug Action",
    author: "James M. Ritter, Rod Flower, Graeme Henderson",
    publisher: "Elsevier",
    category: "Pharmacology",
    isbn: "978-0702074486",
    lang: "en",
    year: 2019,
    call_number: "QV 4 R196p 2019",
    description: "Student-friendly textbook delivering core knowledge of drug discovery, receptor pharmacology, molecular targets, and therapeutics.",
    colors: { primary: "#0e7490", secondary: "#083344", accent: "#67e8f9" }
  },
  {
    title: "Kaplan & Sadock's Synopsis of Psychiatry",
    subtitle: "12th Edition - Behavioral Sciences & Clinical Psychiatry",
    author: "Robert Boland, Marcia L. Verduin",
    publisher: "Lippincott Williams & Wilkins",
    category: "Psychiatry",
    isbn: "978-1975145569",
    lang: "en",
    year: 2021,
    call_number: "WM 100 K17s 2021",
    description: "Complete overview of the clinical psychiatric field, DSM-5 diagnostic criteria, psychotherapeutic modalities, and psychopharmacology.",
    colors: { primary: "#6b21a8", secondary: "#3b0764", accent: "#d8b4fe" }
  },
  {
    title: "Rook's Textbook of Dermatology",
    subtitle: "9th Edition - Comprehensive Dermatological Reference",
    author: "Christopher Griffiths, Jonathan Barker, Tanya Bleiker",
    publisher: "Wiley-Blackwell",
    category: "Dermatology",
    isbn: "978-1118441213",
    lang: "en",
    year: 2016,
    call_number: "WR 100 R777t 2016",
    description: "The definitive skin disease manual offering unparalleled diagnostic depth, histopathology imagery, and therapeutic guidance for dermatologists.",
    colors: { primary: "#b45309", secondary: "#451a03", accent: "#fde047" }
  },
  {
    title: "تشريح الإنسان والفيزيولوجيا",
    subtitle: "دراسة شاملة وبسيطة لبنية ووظائف جسم الإنسان",
    arabic_title: "تشريح الإنسان والفيزيولوجيا - د. سعيد أرسلان",
    author: "د. سعيد أرسلان",
    publisher: "دار القلم",
    category: "Anatomy",
    isbn: "978-9933120456",
    lang: "ar",
    year: 2018,
    call_number: "QS 4 A782 2018",
    description: "كتاب جامعي مبسط يشرح تفصيلياً جهاز الهيكل العظمي والعضلات والجهاز العصبي والدوري بأسلوب علمي واضح باللغة العربية.",
    colors: { primary: "#1d4ed8", secondary: "#0f172a", accent: "#60a5fa" }
  },
  {
    title: "الموجز في الفسيولوجيا الطبية",
    subtitle: "الوظائف الحيوية والحيوانية لأعضاء جسم الإنسان",
    arabic_title: "الموجز في الفسيولوجيا الطبية - د. عمر الفاروق",
    author: "د. عمر الفاروق",
    publisher: "دار الفكر الجامعي",
    category: "Physiology",
    isbn: "978-9953110892",
    lang: "ar",
    year: 2021,
    call_number: "QT 104 F236m 2021",
    description: "مرجع شامل في وظائف الأعضاء، الغدد الصماء، الدورة الدموية، والتوازن التناضحي للبشر.",
    colors: { primary: "#0f766e", secondary: "#042f2e", accent: "#2dd4bf" }
  },
  {
    title: "Emery's Elements of Medical Genetics",
    subtitle: "16th Edition - Clinical & Molecular Genetics",
    author: "Peter D. Turnpenny, Sian Ellard",
    publisher: "Elsevier",
    category: "Medical Genetics",
    isbn: "978-0702079665",
    lang: "en",
    year: 2021,
    call_number: "QZ 50 T956e 2021",
    description: "Clear introduction to basic molecular genetics, genomic medicine, gene editing, and hereditary counseling.",
    colors: { primary: "#3730a3", secondary: "#0f172a", accent: "#38bdf8" }
  },
  {
    title: "Bates' Guide to Physical Examination",
    subtitle: "13th Edition - Physical Exam & History Taking",
    author: "Lynn S. Bickley, Peter G. Szilagyi",
    publisher: "Lippincott Williams & Wilkins",
    category: "Clinical Examination",
    isbn: "978-1496398178",
    lang: "en",
    year: 2020,
    call_number: "WB 205 B583g 2020",
    description: "Step-by-step guide to clinical interviewing, physical examination techniques, health assessment, and clinical reasoning.",
    colors: { primary: "#991b1b", secondary: "#450a0a", accent: "#fca5a5" }
  }
];

export async function ensureMedicalBooksSeeded() {
  const db = await database();
  const today = new Date();

  // 1. Repair any existing books in database that are missing a cover_path
  const booksMissingCovers = await db.select<{ id: string; title: string; category_id: string }[]>(
    "SELECT id, title, category_id FROM books WHERE cover_path IS NULL OR cover_path = ''"
  );

  for (const bk of booksMissingCovers) {
    const catRows = await db.select<{ name: string }[]>("SELECT name FROM categories WHERE id = ?", [bk.category_id]);
    const catName = catRows[0]?.name || "Medical Reference";
    const authRows = await db.select<{ name: string }[]>(
      "SELECT a.name FROM authors a JOIN book_authors ba ON a.id = ba.author_id WHERE ba.book_id = ?",
      [bk.id]
    );
    const authName = authRows[0]?.name || "Author";
    const svgCover = generateMedicalCoverSvg(bk.title, authName, catName);
    await db.execute("UPDATE books SET cover_path = ? WHERE id = ?", [svgCover, bk.id]);
  }

  // 2. Ensure all medical books are inserted
  let copyCounter = 5000;
  for (const b of medicalBooksData) {
    const existing = await db.select<{ id: string }[]>("SELECT id FROM books WHERE title = ?", [b.title]);
    let bookId: string;

    const coverPath = generateMedicalCoverSvg(
      b.title,
      b.author,
      b.category,
      b.subtitle,
      b.colors.primary,
      b.colors.secondary,
      b.colors.accent
    );

    if (existing.length === 0) {
      bookId = id();

      // Category
      let categoryId = id();
      await db.execute("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)", [categoryId, b.category]);
      const catRows = await db.select<{ id: string }[]>("SELECT id FROM categories WHERE name=?", [b.category]);
      categoryId = catRows[0].id;

      // Publisher
      let publisherId: string | null = null;
      if (b.publisher) {
        publisherId = id();
        await db.execute("INSERT OR IGNORE INTO publishers (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [publisherId, b.publisher, today.toISOString(), today.toISOString()]);
        const pubRows = await db.select<{ id: string }[]>("SELECT id FROM publishers WHERE name=?", [b.publisher]);
        publisherId = pubRows[0].id;
      }

      await db.execute(
        `INSERT INTO books (id, title, subtitle, arabic_title, description, isbn13, category_id, publisher_id, language, publication_year, call_number, cover_path, source, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
        [bookId, b.title, b.subtitle || null, b.arabic_title || null, b.description || null, b.isbn, categoryId, publisherId, b.lang, b.year || null, b.call_number || null, coverPath, today.toISOString(), today.toISOString()]
      );

      // Author
      let authorId = id();
      await db.execute("INSERT OR IGNORE INTO authors (id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [authorId, b.author, b.author.toLowerCase(), today.toISOString(), today.toISOString()]);
      const authRows = await db.select<{ id: string }[]>("SELECT id FROM authors WHERE normalized_name=?", [b.author.toLowerCase()]);
      authorId = authRows[0].id;
      await db.execute("INSERT INTO book_authors (book_id, author_id, author_order) VALUES (?, ?, 0)", [bookId, authorId]);

      // Copies with UUID accession numbers
      const numCopies = Math.floor(Math.random() * 3) + 3;
      for (let i = 0; i < numCopies; i++) {
        const copyId = id();
        const accession = id();
        const barcode = `WA-MED-${copyCounter++}`;
        await db.execute(
          "INSERT INTO copies (id, book_id, accession_number, barcode, status, condition, created_at, updated_at) VALUES (?, ?, ?, ?, 'available', 'good', ?, ?)",
          [copyId, bookId, accession, barcode, today.toISOString(), today.toISOString()]
        );
      }
    } else {
      bookId = existing[0].id;
      await db.execute("UPDATE books SET cover_path = ? WHERE id = ? AND (cover_path IS NULL OR cover_path = '')", [coverPath, bookId]);
    }
  }
}

export async function seedDummyData() {
  const db = await database();

  await db.execute("DELETE FROM fines");
  await db.execute("DELETE FROM inventory_scans");
  await db.execute("DELETE FROM inventory_sessions");
  await db.execute("DELETE FROM loans");
  await db.execute("DELETE FROM reservations");
  await db.execute("DELETE FROM attachments");
  await db.execute("DELETE FROM copies");
  await db.execute("DELETE FROM book_authors");
  await db.execute("DELETE FROM book_tags");
  await db.execute("DELETE FROM books");
  await db.execute("DELETE FROM authors");
  await db.execute("DELETE FROM tags");
  await db.execute("DELETE FROM publishers");
  await db.execute("DELETE FROM categories");
  await db.execute("DELETE FROM members");
  await db.execute("DELETE FROM shelves");
  await db.execute("DELETE FROM audit_logs");
  await db.execute("DELETE FROM saved_searches");
  await db.execute("DELETE FROM integration_cache");

  const today = new Date();
  const pastWeek = new Date();
  pastWeek.setDate(today.getDate() - 7);
  const pastMonth = new Date();
  pastMonth.setMonth(today.getMonth() - 1);

  const membersData = [
    { name: "Ahmed Yelles", dpt: "Cardiology", role: "Resident" },
    { name: "Salima K.", dpt: "Pediatrics", role: "Specialist" },
    { name: "Yacine B.", dpt: "Neurology", role: "Resident" },
    { name: "Meriem Z.", dpt: "Internal Medicine", role: "Professor" },
    { name: "Karim F.", dpt: "Surgery", role: "Nurse" },
    { name: "Fatima R.", dpt: "Radiology", role: "Resident" },
    { name: "Nassim D.", dpt: "Emergency", role: "Doctor" },
  ];

  const createdMembers: string[] = [];
  for (let i = 0; i < membersData.length; i++) {
    const m = membersData[i];
    const memberId = id();
    await db.execute(
      "INSERT INTO members (id, member_number, full_name, email, department, role, status, joined_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9)",
      [memberId, `M-${1042 + i}`, m.name, `${m.name.toLowerCase().replace(/ /g, '.')}@hospital.dz`, m.dpt, m.role, randomDateBetween(new Date(2023, 0, 1), pastMonth), today.toISOString(), today.toISOString()]
    );
    createdMembers.push(memberId);
  }

  await ensureMedicalBooksSeeded();

  // Create random loans for the newly created copies
  const allCopies = await db.select<{ id: string }[]>("SELECT id FROM copies");
  const createdCopies = allCopies.map(c => c.id);

  if (createdCopies.length > 0 && createdMembers.length > 0) {
    for (let i = 0; i < 35; i++) {
      const memberId = createdMembers[Math.floor(Math.random() * createdMembers.length)];
      const copyId = createdCopies[Math.floor(Math.random() * createdCopies.length)];

      const isReturned = Math.random() < 0.6;
      const isOverdue = !isReturned && Math.random() < 0.4;
      const loanId = id();

      let borrowedDate: Date;
      let dueDateObj: Date;
      let returnedDateStr: string | null = null;

      if (isReturned) {
        borrowedDate = new Date(randomDateBetween(pastMonth, pastWeek));
        dueDateObj = new Date(borrowedDate);
        dueDateObj.setDate(dueDateObj.getDate() + 14);

        const returnedDate = new Date(borrowedDate);
        returnedDate.setDate(returnedDate.getDate() + Math.floor(Math.random() * 10) + 1);
        returnedDateStr = returnedDate.toISOString();
      } else if (isOverdue) {
        borrowedDate = new Date(randomDateBetween(new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000), new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000)));
        dueDateObj = new Date(borrowedDate);
        dueDateObj.setDate(dueDateObj.getDate() + 14);
      } else {
        borrowedDate = new Date(randomDateBetween(pastWeek, today));
        dueDateObj = new Date(borrowedDate);
        dueDateObj.setDate(dueDateObj.getDate() + 14);
      }

      await db.execute(
        "INSERT INTO loans (id, copy_id, member_id, borrowed_at, due_at, returned_at, renewed_count) VALUES ($1, $2, $3, $4, $5, $6, 0)",
        [loanId, copyId, memberId, borrowedDate.toISOString(), dueDateObj.toISOString(), returnedDateStr]
      );

      if (!isReturned) {
        await db.execute("UPDATE copies SET status = 'on-loan' WHERE id = $1", [copyId]);
      }
    }
  }
}
