"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "obliq-administration-v1";
const CALENDAR_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const STATUS_LABELS = {
  booked: "Записан",
  confirmed: "Потвърден",
  canceled: "Отменен",
};

const VIEW_TITLES = {
  dashboard: "Dashboard",
  clients: "Клиентски Досиета",
  clientEdit: "Досие на клиент",
  calendar: "Календар и Контрол",
  bookingNew: "Нов запис",
  specialists: "Специалисти",
  specialistEdit: "Редакция на специалист",
  problems: "Проблеми",
  problemEdit: "Редакция на проблем",
  treatments: "Процедури",
  treatmentEdit: "Редакция на процедура",
  mapping: "Проблеми ↔ Процедури",
  pricing: "Ценоразпис",
  priceEdit: "Редакция на услуга",
  cms: "CMS Страници",
  cmsEdit: "Редакция на CMS страница",
};

const NAV_ITEMS = [
  ["dashboard", VIEW_TITLES.dashboard],
  ["clients", VIEW_TITLES.clients],
  ["calendar", VIEW_TITLES.calendar],
  ["specialists", VIEW_TITLES.specialists],
  ["problems", VIEW_TITLES.problems],
  ["treatments", VIEW_TITLES.treatments],
  ["mapping", VIEW_TITLES.mapping],
  ["pricing", VIEW_TITLES.pricing],
  ["cms", VIEW_TITLES.cms],
];

const VIEW_PARENTS = {
  clientEdit: "clients",
  bookingNew: "calendar",
  specialistEdit: "specialists",
  problemEdit: "problems",
  treatmentEdit: "treatments",
  priceEdit: "pricing",
  cmsEdit: "cms",
};

function navView(view) {
  return VIEW_PARENTS[view] ?? view;
}

function localISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODate(iso) {
  if (!iso) return new Date();
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDaysISO(isoDate, days) {
  const date = parseISODate(isoDate);
  date.setDate(date.getDate() + days);
  return localISODate(date);
}

function formatDate(iso) {
  if (!iso) return "-";
  return parseISODate(iso).toLocaleDateString("bg-BG");
}

function dayLabel(iso) {
  return parseISODate(iso).toLocaleDateString("bg-BG", { weekday: "short" });
}

function todayLabel() {
  return new Date().toLocaleString("bg-BG", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uid(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function mondayOfWeek(isoDate) {
  const date = parseISODate(isoDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return localISODate(date);
}

function weekDates(isoDate) {
  const monday = mondayOfWeek(isoDate);
  return Array.from({ length: 7 }, (_, index) => addDaysISO(monday, index));
}

function formatPrice(entry) {
  if (entry.type === "range") {
    return `${entry.from} - ${entry.to} лв.`;
  }
  return `${entry.from} лв.`;
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0400-\u04FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeProblem(problem, index = 0) {
  const name = problem?.name || `Проблем ${index + 1}`;
  return {
    id: problem?.id || uid("p"),
    name,
    slug: problem?.slug || slugify(name),
    status: problem?.status || "active",
    description: problem?.description || "",
    clinicalOverview: problem?.clinicalOverview || "",
    affectedZones: problem?.affectedZones || "",
    assessmentNotes: problem?.assessmentNotes || "",
    updatedAt: problem?.updatedAt || localISODate(new Date()),
  };
}

function normalizeTreatment(treatment, index = 0) {
  const name = treatment?.name || `Процедура ${index + 1}`;
  return {
    id: treatment?.id || uid("t"),
    name,
    slug: treatment?.slug || slugify(name),
    status: treatment?.status || "active",
    description: treatment?.description || "",
    protocol: treatment?.protocol || "",
    duration: treatment?.duration || "",
    recovery: treatment?.recovery || "",
    safetyNotes: treatment?.safetyNotes || "",
    updatedAt: treatment?.updatedAt || localISODate(new Date()),
  };
}

function normalizeSpecialist(specialist, index = 0) {
  if (typeof specialist === "string") {
    return {
      id: uid("sp"),
      name: specialist,
      role: "Естетичен лекар",
      status: "active",
      phone: "",
      email: "",
      notes: "",
      updatedAt: localISODate(new Date()),
    };
  }
  const name = specialist?.name || `Специалист ${index + 1}`;
  return {
    id: specialist?.id || uid("sp"),
    name,
    role: specialist?.role || "Естетичен лекар",
    status: specialist?.status || "active",
    phone: specialist?.phone || "",
    email: specialist?.email || "",
    notes: specialist?.notes || "",
    updatedAt: specialist?.updatedAt || localISODate(new Date()),
  };
}

function normalizeAppointmentStatus(status) {
  if (status === "completed") return "confirmed";
  if (status === "booked" || status === "confirmed" || status === "canceled") return status;
  return "booked";
}

function sanitizeProblemTreatmentLinks(problemIds, treatmentIds, rawLinks) {
  const validProblemIds = new Set(problemIds);
  const validTreatmentIds = new Set(treatmentIds);
  const result = {};

  validProblemIds.forEach((problemId) => {
    const links = Array.isArray(rawLinks?.[problemId]) ? rawLinks[problemId] : [];
    result[problemId] = [...new Set(links)].filter((treatmentId) => validTreatmentIds.has(treatmentId));
  });

  return result;
}

function createDefaultData() {
  const today = localISODate(new Date());
  const specialists = [
    {
      id: "sp-001",
      name: "Д-р Елена Стоянова",
      role: "Дерматолог",
      status: "active",
      phone: "+359 888 221 101",
      email: "e.stoyanova@obliq.bg",
      notes: "Фокус: skin quality и регенеративни протоколи.",
      updatedAt: today,
    },
    {
      id: "sp-002",
      name: "Д-р Виктор Ненков",
      role: "Естетичен лекар",
      status: "active",
      phone: "+359 888 221 102",
      email: "v.nenkov@obliq.bg",
      notes: "Фокус: контуриране и структурни корекции.",
      updatedAt: today,
    },
    {
      id: "sp-003",
      name: "Д-р Мария Петрова",
      role: "Дерматолог",
      status: "active",
      phone: "+359 888 221 103",
      email: "m.petrova@obliq.bg",
      notes: "Фокус: чувствителна кожа и терапевтични протоколи.",
      updatedAt: today,
    },
    {
      id: "sp-004",
      name: "Д-р Михаил Михайлов",
      role: "Естетичен лекар",
      status: "active",
      phone: "+359 888 221 104",
      email: "m.mihaylov@obliq.bg",
      notes: "Фокус: инжекционни протоколи и индивидуално планиране.",
      updatedAt: today,
    },
  ];

  const problems = [
    {
      id: "p-acne",
      name: "Акне",
      slug: "akne",
      status: "active",
      description: "Възпаления, несъвършенства и белези.",
      clinicalOverview: "Състояние с възпалителни и невъзпалителни лезии, изискващи етапен подход.",
      affectedZones: "Т-зона, бузи, линия на долна челюст",
      assessmentNotes: "Оценка на активни лезии, белези и реактивност преди протокол.",
      updatedAt: today,
    },
    {
      id: "p-wrinkles",
      name: "Бръчки",
      slug: "bruchki",
      status: "active",
      description: "Фини и динамични линии.",
      clinicalOverview: "Динамични и статични линии, свързани с мимика и обемни промени.",
      affectedZones: "Периорбитално, чело, глабела",
      assessmentNotes: "Оценка в покой и при мимика за прецизен контрол.",
      updatedAt: today,
    },
    {
      id: "p-pigment",
      name: "Пигментация",
      slug: "pigmentacia",
      status: "active",
      description: "Неравномерен тен и петна.",
      clinicalOverview: "Дисколорации от фотостареене, поствъзпалителни промени и хормонален фон.",
      affectedZones: "Бузи, чело, горна устна",
      assessmentNotes: "Оценка за тип пигмент и сезонност преди протокол.",
      updatedAt: today,
    },
    {
      id: "p-dehydration",
      name: "Дехидратация",
      slug: "dehidratacia",
      status: "active",
      description: "Липса на плътност и блясък.",
      clinicalOverview: "Нарушен воден баланс и отслабена бариерна функция.",
      affectedZones: "Цяло лице, периорална зона",
      assessmentNotes: "Фокус върху текстура, комфорт и възстановяване на бариерата.",
      updatedAt: today,
    },
    {
      id: "p-sensitive",
      name: "Чувствителна кожа",
      slug: "chuvstvitelna-kozha",
      status: "active",
      description: "Реактивност, зачервяване и дискомфорт.",
      clinicalOverview: "Повишена реактивност към термични, механични и активни стимули.",
      affectedZones: "Бузи, периорално, шия",
      assessmentNotes: "Щадящи протоколи и внимателно стъпково надграждане.",
      updatedAt: today,
    },
  ];

  const treatments = [
    {
      id: "t-botox",
      name: "Botulinum Precision",
      slug: "botulinum-precision",
      status: "active",
      description: "Контролирано омекотяване на динамични линии.",
      protocol: "Микродозиране с фокус върху естествен израз и симетрия.",
      duration: "30-40 мин",
      recovery: "Без престой, контрол след 14 дни.",
      safetyNotes: "Избягване на натиск и интензивни натоварвания 24 часа.",
      updatedAt: today,
    },
    {
      id: "t-fillers",
      name: "Structural Fillers",
      slug: "structural-fillers",
      status: "active",
      description: "Възстановяване на обем и баланс.",
      protocol: "План по зони с приоритет анатомичен баланс и мек контур.",
      duration: "45-60 мин",
      recovery: "Лек оток 24-72 часа.",
      safetyNotes: "Контролен преглед и адаптация при нужда.",
      updatedAt: today,
    },
    {
      id: "t-prp",
      name: "PRP Regeneration",
      slug: "prp-regeneration",
      status: "active",
      description: "Стимулиране на естествено възстановяване.",
      protocol: "Серийна терапия със собствен материал и проследяване на отговор.",
      duration: "40-50 мин",
      recovery: "Леко зачервяване до 24 часа.",
      safetyNotes: "Щадящ режим в първите 48 часа.",
      updatedAt: today,
    },
    {
      id: "t-laser",
      name: "Laser Correction",
      slug: "laser-correction",
      status: "active",
      description: "Прецизен фокус върху текстура и пигмент.",
      protocol: "Етапен подход според фототип и клинична оценка.",
      duration: "30-45 мин",
      recovery: "Възможна кратка еритема 24-48 часа.",
      safetyNotes: "Стриктен фотопротекционен режим след процедура.",
      updatedAt: today,
    },
    {
      id: "t-boosters",
      name: "Skin Boosters",
      slug: "skin-boosters",
      status: "active",
      description: "Дълбока хидратация и свежа плътност.",
      protocol: "Серийни сесии за плътност, еластичност и качество на кожата.",
      duration: "30-40 мин",
      recovery: "Минимални папули до 24 часа.",
      safetyNotes: "Щадяща рутина и без активи 48 часа.",
      updatedAt: today,
    },
  ];

  return {
    specialists,
    problems,
    treatments,
    problemTreatmentLinks: {
      "p-acne": ["t-laser", "t-prp", "t-boosters"],
      "p-wrinkles": ["t-botox", "t-fillers", "t-boosters"],
      "p-pigment": ["t-laser", "t-prp"],
      "p-dehydration": ["t-boosters", "t-prp"],
      "p-sensitive": ["t-boosters", "t-prp"],
    },
    clients: [
      {
        id: "cl-001",
        name: "Анелия Георгиева",
        phone: "+359 888 123 001",
        email: "anelia@obliq.bg",
        dob: "1991-02-14",
        firstVisit: addDaysISO(today, -120),
        assignedSpecialist: specialists[0].name,
        skinProfile: {
          type: "Комбинирана",
          problems: ["p-pigment", "p-dehydration"],
          sensitivity: "Средна",
          notes: "Реактивност в периорална зона. Нужен щадящ протокол.",
        },
        visits: [
          {
            id: "v-001",
            date: addDaysISO(today, -45),
            procedure: "Skin Boosters",
            doctor: specialists[0].name,
            notes: "Плавно въвеждане, без зачервяване след 48ч.",
            result: "По-равномерна текстура и блясък.",
          },
          {
            id: "v-002",
            date: addDaysISO(today, -20),
            procedure: "PRP Regeneration",
            doctor: specialists[0].name,
            notes: "Контролен преглед след 4 седмици.",
            result: "Подобрена плътност в средна зона.",
          },
        ],
        recommendations: ["SPF 50 ежедневно", "Избягване на активи 72 часа след процедура"],
        notes: [
          {
            id: "n-001",
            date: addDaysISO(today, -2),
            text: "Да се избегне термично натоварване до следващия контрол.",
            important: true,
          },
        ],
      },
      {
        id: "cl-002",
        name: "Ирина Тодорова",
        phone: "+359 888 123 002",
        email: "irina@obliq.bg",
        dob: "1987-06-03",
        firstVisit: addDaysISO(today, -15),
        assignedSpecialist: specialists[1].name,
        skinProfile: {
          type: "Суха",
          problems: ["p-wrinkles", "p-dehydration"],
          sensitivity: "Ниска",
          notes: "Добра толерантност към комбинирани протоколи.",
        },
        visits: [
          {
            id: "v-003",
            date: addDaysISO(today, -14),
            procedure: "Botulinum Precision",
            doctor: specialists[1].name,
            notes: "Фокус периорбитално.",
            result: "По-спокоен израз без загуба на мимика.",
          },
        ],
        recommendations: ["Контрол след 21 дни", "Интензивна вечерна хидратация"],
        notes: [],
      },
      {
        id: "cl-003",
        name: "Кристина Алексиева",
        phone: "+359 888 123 003",
        email: "kristina@obliq.bg",
        dob: "1994-11-21",
        firstVisit: addDaysISO(today, -6),
        assignedSpecialist: specialists[2].name,
        skinProfile: {
          type: "Мазна",
          problems: ["p-acne", "p-sensitive"],
          sensitivity: "Висока",
          notes: "Периодични възпалителни епизоди в Т-зоната.",
        },
        visits: [],
        recommendations: ["Щадяща рутина без механични ексфолианти"],
        notes: [
          {
            id: "n-002",
            date: addDaysISO(today, -1),
            text: "Първият протокол да остане консервативен.",
            important: false,
          },
        ],
      },
    ],
    appointments: [
      {
        id: "a-001",
        date: today,
        time: "10:00",
        clientId: "cl-001",
        clientName: "Анелия Георгиева",
        procedure: "PRP Regeneration",
        specialist: specialists[0].name,
        status: "confirmed",
        kind: "existing",
      },
      {
        id: "a-002",
        date: today,
        time: "12:00",
        clientId: "cl-002",
        clientName: "Ирина Тодорова",
        procedure: "Botulinum Precision",
        specialist: specialists[1].name,
        status: "booked",
        kind: "existing",
      },
      {
        id: "a-003",
        date: addDaysISO(today, 1),
        time: "11:00",
        clientId: "cl-003",
        clientName: "Кристина Алексиева",
        procedure: "Консултация",
        specialist: specialists[2].name,
        status: "booked",
        kind: "existing",
      },
    ],
    pricing: [
      {
        id: "pr-001",
        name: "Refinement around the eyes",
        type: "range",
        from: 420,
        to: 620,
      },
      {
        id: "pr-002",
        name: "Contour Balance",
        type: "range",
        from: 760,
        to: 1200,
      },
      {
        id: "pr-003",
        name: "Skin Quality Protocol",
        type: "fixed",
        from: 590,
        to: null,
      },
    ],
    cmsPages: [
      {
        id: "cms-home",
        title: "Начална страница",
        slug: "/",
        status: "live",
        heroTitle: "Medical Aesthetics. Precisely Controlled.",
        heroSubtitle: "Клиничен подход към естествена естетика.",
        cta: "Запази консултация",
        metaDescription: "Obliq естетичен медицински център с фокус върху прецизност и спокойствие.",
        updatedAt: today,
      },
      {
        id: "cms-services",
        title: "Процедури",
        slug: "/procedures",
        status: "live",
        heroTitle: "Protocols Tailored to Clinical Needs.",
        heroSubtitle: "Фиксирани услуги, ясни резултати, предвидим процес.",
        cta: "Разгледай процедурите",
        metaDescription: "Процедури в Obliq, базирани на медицинска оценка.",
        updatedAt: addDaysISO(today, -4),
      },
      {
        id: "cms-contact",
        title: "Контакт",
        slug: "/contact",
        status: "draft",
        heroTitle: "Консултация в контролирана среда.",
        heroSubtitle: "Изпрати запитване и ще върнем структуриран отговор.",
        cta: "Изпрати запитване",
        metaDescription: "Контакт с медицинския екип на Obliq.",
        updatedAt: addDaysISO(today, -1),
      },
    ],
  };
}

function hydrateData(defaults, stored) {
  if (!stored || typeof stored !== "object") return defaults;
  let specialists = (
    Array.isArray(stored.specialists) ? stored.specialists : defaults.specialists
  ).map((specialist, index) => normalizeSpecialist(specialist, index));
  if (!specialists.some((specialist) => specialist.name === "Д-р Михаил Михайлов")) {
    specialists = [
      ...specialists,
      normalizeSpecialist(
        {
          id: "sp-004",
          name: "Д-р Михаил Михайлов",
          role: "Естетичен лекар",
          status: "active",
          phone: "+359 888 221 104",
          email: "m.mihaylov@obliq.bg",
          notes: "Фокус: инжекционни протоколи и индивидуално планиране.",
          updatedAt: localISODate(new Date()),
        },
        specialists.length,
      ),
    ];
  }
  const problems = (Array.isArray(stored.problems) ? stored.problems : defaults.problems).map((problem, index) =>
    normalizeProblem(problem, index),
  );
  const treatments = (
    Array.isArray(stored.treatments) ? stored.treatments : defaults.treatments
  ).map((treatment, index) => normalizeTreatment(treatment, index));
  const problemTreatmentLinks = sanitizeProblemTreatmentLinks(
    problems.map((problem) => problem.id),
    treatments.map((treatment) => treatment.id),
    stored.problemTreatmentLinks && typeof stored.problemTreatmentLinks === "object"
      ? stored.problemTreatmentLinks
      : defaults.problemTreatmentLinks,
  );

  return {
    ...defaults,
    ...stored,
    specialists,
    problems,
    treatments,
    clients: Array.isArray(stored.clients) ? stored.clients : defaults.clients,
    appointments: (Array.isArray(stored.appointments) ? stored.appointments : defaults.appointments).map(
      (appointment) => ({
        ...appointment,
        status: normalizeAppointmentStatus(appointment?.status),
      }),
    ),
    pricing: Array.isArray(stored.pricing) ? stored.pricing : defaults.pricing,
    cmsPages: Array.isArray(stored.cmsPages) ? stored.cmsPages : defaults.cmsPages,
    problemTreatmentLinks,
  };
}

function EmptyState({ text = "Няма данни за показване." }) {
  return (
    <div className="empty-state">
      <p>{text}</p>
    </div>
  );
}

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);

  const [activeView, setActiveView] = useState("dashboard");
  const [clientTab, setClientTab] = useState("overview");
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState(null);
  const [selectedProblemId, setSelectedProblemId] = useState(null);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState(null);
  const [selectedPriceId, setSelectedPriceId] = useState(null);
  const [selectedCmsId, setSelectedCmsId] = useState(null);

  const [calendarMode, setCalendarMode] = useState("week");
  const [calendarDate, setCalendarDate] = useState("");
  const [calendarSpecialist, setCalendarSpecialist] = useState("all");
  const [calendarStatus, setCalendarStatus] = useState("all");
  const [hoverCell, setHoverCell] = useState("");

  const [clientSearch, setClientSearch] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [now, setNow] = useState("");

  const [newRecommendation, setNewRecommendation] = useState("");
  const [visitForm, setVisitForm] = useState({
    date: "",
    procedure: "",
    doctor: "",
    notes: "",
    result: "",
  });
  const [noteForm, setNoteForm] = useState({
    text: "",
    important: false,
  });
  const [bookingForm, setBookingForm] = useState({
    kind: "existing",
    existingClientId: "",
    newClientName: "",
    procedure: "Консултация",
    date: "",
    time: CALENDAR_TIMES[0],
    specialist: "",
  });
  const [priceDraft, setPriceDraft] = useState({
    name: "",
    type: "fixed",
    from: "",
    to: "",
  });
  const [cmsDraft, setCmsDraft] = useState(null);
  const [specialistDraft, setSpecialistDraft] = useState(null);
  const [problemDraft, setProblemDraft] = useState(null);
  const [treatmentDraft, setTreatmentDraft] = useState(null);

  useEffect(() => {
    const defaults = createDefaultData();
    let loaded = defaults;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        loaded = hydrateData(defaults, JSON.parse(raw));
      }
    } catch {
      loaded = defaults;
    }

    const today = localISODate(new Date());
    setData(loaded);
    setSelectedClientId(loaded.clients[0]?.id ?? null);
    setSelectedSpecialistId(loaded.specialists[0]?.id ?? null);
    setSelectedProblemId(loaded.problems[0]?.id ?? null);
    setSelectedTreatmentId(loaded.treatments[0]?.id ?? null);
    setSelectedPriceId(loaded.pricing[0]?.id ?? null);
    setSelectedCmsId(loaded.cmsPages[0]?.id ?? null);
    setCalendarDate(today);
    setBookingForm((prev) => ({
      ...prev,
      date: today,
      specialist: loaded.specialists[0]?.name ?? "",
      existingClientId: loaded.clients[0]?.id ?? "",
      procedure: loaded.treatments[0]?.name ?? "Консултация",
    }));
    setVisitForm({
      date: today,
      procedure: "",
      doctor: loaded.specialists[0]?.name ?? "",
      notes: "",
      result: "",
    });
    setNow(todayLabel());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !data) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, ready]);

  useEffect(() => {
    if (!ready) return undefined;
    const timer = window.setInterval(() => {
      setNow(todayLabel());
    }, 30000);
    return () => {
      window.clearInterval(timer);
    };
  }, [ready]);

  useEffect(() => {
    if (!data) return;
    if (selectedClientId && !data.clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(data.clients[0]?.id ?? null);
    }
    if (selectedSpecialistId && !data.specialists.some((specialist) => specialist.id === selectedSpecialistId)) {
      setSelectedSpecialistId(data.specialists[0]?.id ?? null);
    }
    if (selectedProblemId && !data.problems.some((problem) => problem.id === selectedProblemId)) {
      setSelectedProblemId(data.problems[0]?.id ?? null);
    }
    if (selectedTreatmentId && !data.treatments.some((treatment) => treatment.id === selectedTreatmentId)) {
      setSelectedTreatmentId(data.treatments[0]?.id ?? null);
    }
    if (selectedPriceId && !data.pricing.some((entry) => entry.id === selectedPriceId)) {
      setSelectedPriceId(data.pricing[0]?.id ?? null);
    }
    if (selectedCmsId && !data.cmsPages.some((page) => page.id === selectedCmsId)) {
      setSelectedCmsId(data.cmsPages[0]?.id ?? null);
    }
  }, [data, selectedClientId, selectedSpecialistId, selectedProblemId, selectedTreatmentId, selectedPriceId, selectedCmsId]);

  const selectedClient = useMemo(
    () => data?.clients.find((client) => client.id === selectedClientId) ?? null,
    [data, selectedClientId],
  );

  const selectedSpecialist = useMemo(
    () => data?.specialists.find((specialist) => specialist.id === selectedSpecialistId) ?? null,
    [data, selectedSpecialistId],
  );

  const selectedProblem = useMemo(
    () => data?.problems.find((problem) => problem.id === selectedProblemId) ?? null,
    [data, selectedProblemId],
  );

  const selectedTreatment = useMemo(
    () => data?.treatments.find((treatment) => treatment.id === selectedTreatmentId) ?? null,
    [data, selectedTreatmentId],
  );

  const selectedPrice = useMemo(
    () => data?.pricing.find((entry) => entry.id === selectedPriceId) ?? null,
    [data, selectedPriceId],
  );

  const selectedCmsPage = useMemo(
    () => data?.cmsPages.find((page) => page.id === selectedCmsId) ?? null,
    [data, selectedCmsId],
  );

  useEffect(() => {
    if (!selectedCmsPage) {
      setCmsDraft(null);
      return;
    }
    setCmsDraft({
      title: selectedCmsPage.title,
      heroTitle: selectedCmsPage.heroTitle,
      heroSubtitle: selectedCmsPage.heroSubtitle,
      cta: selectedCmsPage.cta,
      metaDescription: selectedCmsPage.metaDescription,
      status: selectedCmsPage.status,
    });
  }, [selectedCmsPage]);

  useEffect(() => {
    if (!selectedSpecialist) {
      setSpecialistDraft(null);
      return;
    }
    setSpecialistDraft({
      name: selectedSpecialist.name,
      role: selectedSpecialist.role,
      status: selectedSpecialist.status,
      phone: selectedSpecialist.phone,
      email: selectedSpecialist.email,
      notes: selectedSpecialist.notes,
    });
  }, [selectedSpecialist]);

  useEffect(() => {
    if (!selectedProblem) {
      setProblemDraft(null);
      return;
    }
    setProblemDraft({
      name: selectedProblem.name,
      slug: selectedProblem.slug,
      status: selectedProblem.status,
      description: selectedProblem.description,
      clinicalOverview: selectedProblem.clinicalOverview,
      affectedZones: selectedProblem.affectedZones,
      assessmentNotes: selectedProblem.assessmentNotes,
    });
  }, [selectedProblem]);

  useEffect(() => {
    if (!selectedTreatment) {
      setTreatmentDraft(null);
      return;
    }
    setTreatmentDraft({
      name: selectedTreatment.name,
      slug: selectedTreatment.slug,
      status: selectedTreatment.status,
      description: selectedTreatment.description,
      protocol: selectedTreatment.protocol,
      duration: selectedTreatment.duration,
      recovery: selectedTreatment.recovery,
      safetyNotes: selectedTreatment.safetyNotes,
    });
  }, [selectedTreatment]);

  useEffect(() => {
    if (!selectedPriceId) return;
    if (!selectedPrice) {
      setPriceDraft({
        name: "",
        type: "fixed",
        from: "",
        to: "",
      });
      return;
    }
    setPriceDraft({
      name: selectedPrice.name,
      type: selectedPrice.type,
      from: String(selectedPrice.from),
      to: selectedPrice.to == null ? "" : String(selectedPrice.to),
    });
  }, [selectedPrice, selectedPriceId]);

  const filteredClients = useMemo(() => {
    if (!data) return [];
    const query = clientSearch.trim().toLowerCase();
    return [...data.clients]
      .filter((client) => {
        if (!query) return true;
        return (
          client.name.toLowerCase().includes(query) ||
          client.phone.toLowerCase().includes(query) ||
          client.email.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.firstVisit.localeCompare(a.firstVisit));
  }, [data, clientSearch]);

  const today = useMemo(() => localISODate(new Date()), []);

  const todayAppointments = useMemo(() => {
    if (!data) return [];
    return data.appointments
      .filter((appointment) => appointment.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [data, today]);

  const newClientsMetric = useMemo(() => {
    if (!data) return 0;
    const thirtyDaysAgo = addDaysISO(today, -30);
    return data.clients.filter((client) => client.firstVisit >= thirtyDaysAgo && client.firstVisit <= today).length;
  }, [data, today]);

  const activeProceduresMetric = useMemo(() => {
    if (!data) return 0;
    return new Set(
      data.appointments
        .filter((entry) => entry.status === "booked" || entry.status === "confirmed")
        .map((entry) => entry.procedure),
    ).size;
  }, [data]);

  const calendarDates = useMemo(() => {
    if (!calendarDate) return [];
    if (calendarMode === "day") return [calendarDate];
    return weekDates(calendarDate);
  }, [calendarDate, calendarMode]);

  const proceduresForBooking = useMemo(() => {
    if (!data) return ["Консултация"];
    return ["Консултация", ...data.treatments.map((treatment) => treatment.name)];
  }, [data]);

  const problemById = useMemo(() => {
    const map = new Map();
    data?.problems.forEach((problem) => map.set(problem.id, problem));
    return map;
  }, [data]);

  const openClientEditor = (clientId) => {
    setSelectedClientId(clientId);
    setClientTab("overview");
    setActiveView("clientEdit");
  };

  const openSpecialistEditor = (specialistId) => {
    setSelectedSpecialistId(specialistId);
    setActiveView("specialistEdit");
  };

  const openProblemEditor = (problemId) => {
    setSelectedProblemId(problemId);
    setActiveView("problemEdit");
  };

  const openTreatmentEditor = (treatmentId) => {
    setSelectedTreatmentId(treatmentId);
    setActiveView("treatmentEdit");
  };

  const openPriceEditor = (priceId) => {
    setSelectedPriceId(priceId);
    setActiveView("priceEdit");
  };

  const openCmsEditor = (cmsId) => {
    setSelectedCmsId(cmsId);
    setActiveView("cmsEdit");
  };

  const updateClient = (clientId, updater) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        clients: prev.clients.map((client) => (client.id === clientId ? updater(client) : client)),
      };
    });
  };

  const addClient = () => {
    if (!data) return;
    const newClient = {
      id: uid("cl"),
      name: "Нов клиент",
      phone: "",
      email: "",
      dob: "",
      firstVisit: localISODate(new Date()),
      assignedSpecialist: data.specialists[0]?.name ?? "",
      skinProfile: {
        type: "Нормална",
        problems: [],
        sensitivity: "Средна",
        notes: "",
      },
      visits: [],
      recommendations: [],
      notes: [],
    };

    setData((prev) => ({ ...prev, clients: [newClient, ...prev.clients] }));
    setSelectedClientId(newClient.id);
    setClientTab("overview");
    setBookingForm((prev) => ({ ...prev, existingClientId: newClient.id }));
    setActiveView("clientEdit");
  };

  const updateSkinProblem = (problemId, checked) => {
    if (!selectedClientId) return;
    updateClient(selectedClientId, (client) => {
      const current = new Set(client.skinProfile.problems);
      if (checked) current.add(problemId);
      if (!checked) current.delete(problemId);
      return {
        ...client,
        skinProfile: {
          ...client.skinProfile,
          problems: [...current],
        },
      };
    });
  };

  const addRecommendation = () => {
    const recommendation = newRecommendation.trim();
    if (!recommendation || !selectedClientId) return;
    updateClient(selectedClientId, (client) => ({
      ...client,
      recommendations: [...client.recommendations, recommendation],
    }));
    setNewRecommendation("");
  };

  const submitVisit = (event) => {
    event.preventDefault();
    if (!selectedClientId) return;
    if (!visitForm.date || !visitForm.procedure || !visitForm.doctor || !visitForm.notes || !visitForm.result) return;

    updateClient(selectedClientId, (client) => ({
      ...client,
      visits: [
        ...client.visits,
        {
          id: uid("visit"),
          date: visitForm.date,
          procedure: visitForm.procedure,
          doctor: visitForm.doctor,
          notes: visitForm.notes,
          result: visitForm.result,
        },
      ],
    }));
    setVisitForm((prev) => ({
      ...prev,
      procedure: "",
      notes: "",
      result: "",
    }));
  };

  const submitNote = (event) => {
    event.preventDefault();
    if (!selectedClientId || !noteForm.text.trim()) return;

    updateClient(selectedClientId, (client) => ({
      ...client,
      notes: [
        ...client.notes,
        {
          id: uid("note"),
          date: localISODate(new Date()),
          text: noteForm.text.trim(),
          important: noteForm.important,
        },
      ],
    }));
    setNoteForm({ text: "", important: false });
  };

  const appointmentMatchesFilters = (appointment) => {
    const specialistMatch = calendarSpecialist === "all" || appointment.specialist === calendarSpecialist;
    const statusMatch = calendarStatus === "all" || appointment.status === calendarStatus;
    return specialistMatch && statusMatch;
  };

  const appointmentsForSlot = (date, time) => {
    if (!data) return [];
    return data.appointments.filter(
      (entry) => entry.date === date && entry.time === time && appointmentMatchesFilters(entry),
    );
  };

  const moveAppointment = (appointmentId, date, time) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        appointments: prev.appointments.map((entry) =>
          entry.id === appointmentId
            ? {
                ...entry,
                date,
                time,
              }
            : entry,
        ),
      };
    });
  };

  const updateAppointmentStatus = (appointmentId, status) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        appointments: prev.appointments.map((entry) =>
          entry.id === appointmentId
            ? {
                ...entry,
                status,
              }
            : entry,
        ),
      };
    });
  };

  const submitBooking = (event) => {
    event.preventDefault();
    if (!data) return;

    if (!bookingForm.date || !bookingForm.time || !bookingForm.specialist) {
      setBookingMessage("Моля попълнете всички полета.");
      return;
    }

    let clientId = bookingForm.existingClientId;
    let clientName = "";
    let procedure = bookingForm.procedure;
    let nextClients = data.clients;

    if (bookingForm.kind === "new") {
      if (!bookingForm.newClientName.trim()) {
        setBookingMessage("Въведете име за нов клиент.");
        return;
      }
      const newClient = {
        id: uid("cl"),
        name: bookingForm.newClientName.trim(),
        phone: "",
        email: "",
        dob: "",
        firstVisit: bookingForm.date,
        assignedSpecialist: bookingForm.specialist,
        skinProfile: {
          type: "Нормална",
          problems: [],
          sensitivity: "Средна",
          notes: "",
        },
        visits: [],
        recommendations: [],
        notes: [],
      };
      nextClients = [newClient, ...data.clients];
      clientId = newClient.id;
      clientName = newClient.name;
      procedure = "Консултация";
      setSelectedClientId(newClient.id);
    } else {
      const client = data.clients.find((entry) => entry.id === bookingForm.existingClientId);
      if (!client) {
        setBookingMessage("Изберете валиден клиент.");
        return;
      }
      clientId = client.id;
      clientName = client.name;
    }

    const newAppointment = {
      id: uid("a"),
      date: bookingForm.date,
      time: bookingForm.time,
      clientId,
      clientName,
      procedure,
      specialist: bookingForm.specialist,
      status: "booked",
      kind: bookingForm.kind,
    };

    setData((prev) => ({
      ...prev,
      clients: bookingForm.kind === "new" ? nextClients : prev.clients,
      appointments: [...prev.appointments, newAppointment],
    }));
    setBookingMessage("Записът е добавен успешно.");
    setCalendarDate(bookingForm.date);
    setActiveView("calendar");
    setBookingForm((prev) => ({
      ...prev,
      kind: "existing",
      existingClientId: clientId,
      newClientName: "",
      procedure: data.treatments[0]?.name ?? "Консултация",
      time: CALENDAR_TIMES[0],
    }));
  };

  const linksForProblem = (problemId) => {
    if (!data) return [];
    return data.problemTreatmentLinks[problemId] ?? [];
  };

  const setLink = (problemId, treatmentId, isLinked) => {
    setData((prev) => {
      if (!prev) return prev;
      if (!prev.problems.some((problem) => problem.id === problemId)) return prev;
      if (!prev.treatments.some((treatment) => treatment.id === treatmentId)) return prev;
      const current = new Set(prev.problemTreatmentLinks[problemId] ?? []);
      if (isLinked) current.add(treatmentId);
      if (!isLinked) current.delete(treatmentId);
      return {
        ...prev,
        problemTreatmentLinks: {
          ...prev.problemTreatmentLinks,
          [problemId]: [...current],
        },
      };
    });
  };

  const addSpecialist = () => {
    const newSpecialist = normalizeSpecialist(
      {
        id: uid("sp"),
        name: "Нов специалист",
        role: "Естетичен лекар",
        status: "active",
        phone: "",
        email: "",
        notes: "",
      },
      data?.specialists?.length ?? 0,
    );

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        specialists: [newSpecialist, ...prev.specialists],
      };
    });
    setSelectedSpecialistId(newSpecialist.id);
    setActiveView("specialistEdit");
    setBookingForm((prev) => ({ ...prev, specialist: newSpecialist.name }));
    setVisitForm((prev) => ({ ...prev, doctor: newSpecialist.name }));
  };

  const saveSpecialist = (event) => {
    event.preventDefault();
    if (!selectedSpecialistId || !specialistDraft) return;

    const name = specialistDraft.name.trim();
    if (!name) return;
    const previousName = selectedSpecialist?.name ?? "";

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        specialists: prev.specialists.map((specialist) =>
          specialist.id === selectedSpecialistId
            ? normalizeSpecialist({
                ...specialist,
                ...specialistDraft,
                name,
                updatedAt: localISODate(new Date()),
              })
            : specialist,
        ),
        clients:
          previousName && previousName !== name
            ? prev.clients.map((client) => ({
                ...client,
                assignedSpecialist:
                  client.assignedSpecialist === previousName ? name : client.assignedSpecialist,
                visits: client.visits.map((visit) => ({
                  ...visit,
                  doctor: visit.doctor === previousName ? name : visit.doctor,
                })),
              }))
            : prev.clients,
        appointments:
          previousName && previousName !== name
            ? prev.appointments.map((appointment) => ({
                ...appointment,
                specialist: appointment.specialist === previousName ? name : appointment.specialist,
              }))
            : prev.appointments,
      };
    });

    if (previousName && previousName !== name) {
      setBookingForm((prev) => ({
        ...prev,
        specialist: prev.specialist === previousName ? name : prev.specialist,
      }));
      setVisitForm((prev) => ({
        ...prev,
        doctor: prev.doctor === previousName ? name : prev.doctor,
      }));
      setCalendarSpecialist((prev) => (prev === previousName ? name : prev));
    }
  };

  const deleteSpecialist = () => {
    if (!selectedSpecialistId) return;
    if ((data?.specialists?.length ?? 0) <= 1) return;

    const removed = data?.specialists.find((specialist) => specialist.id === selectedSpecialistId);
    const removedName = removed?.name ?? "";
    const fallbackName = data?.specialists.find((specialist) => specialist.id !== selectedSpecialistId)?.name ?? "";

    setData((prev) => {
      if (!prev || prev.specialists.length <= 1) return prev;
      const nextSpecialists = prev.specialists.filter((specialist) => specialist.id !== selectedSpecialistId);
      const nextFallbackName = nextSpecialists[0]?.name ?? "";
      return {
        ...prev,
        specialists: nextSpecialists,
        clients: prev.clients.map((client) => ({
          ...client,
          assignedSpecialist:
            client.assignedSpecialist === removedName ? nextFallbackName : client.assignedSpecialist,
          visits: client.visits.map((visit) => ({
            ...visit,
            doctor: visit.doctor === removedName ? nextFallbackName : visit.doctor,
          })),
        })),
        appointments: prev.appointments.map((appointment) => ({
          ...appointment,
          specialist: appointment.specialist === removedName ? nextFallbackName : appointment.specialist,
        })),
      };
    });

    setSelectedSpecialistId((current) => {
      const next = data?.specialists.find((specialist) => specialist.id !== current);
      return next?.id ?? current;
    });
    setBookingForm((prev) => ({
      ...prev,
      specialist: prev.specialist === removedName ? fallbackName : prev.specialist,
    }));
    setVisitForm((prev) => ({
      ...prev,
      doctor: prev.doctor === removedName ? fallbackName : prev.doctor,
    }));
    setCalendarSpecialist((prev) => {
      if (prev === "all") return prev;
      return prev === removedName ? "all" : prev;
    });
    setActiveView("specialists");
  };

  const addProblem = () => {
    const newProblem = normalizeProblem(
      {
        id: uid("p"),
        name: "Нов проблем",
        description: "",
        clinicalOverview: "",
        affectedZones: "",
        assessmentNotes: "",
        status: "active",
      },
      data?.problems?.length ?? 0,
    );

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        problems: [newProblem, ...prev.problems],
        problemTreatmentLinks: {
          ...prev.problemTreatmentLinks,
          [newProblem.id]: [],
        },
      };
    });
    setSelectedProblemId(newProblem.id);
    setActiveView("problemEdit");
  };

  const saveProblem = (event) => {
    event.preventDefault();
    if (!selectedProblemId || !problemDraft) return;
    const name = problemDraft.name.trim();
    if (!name) return;

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        problems: prev.problems.map((problem) =>
          problem.id === selectedProblemId
            ? normalizeProblem({
                ...problem,
                ...problemDraft,
                name,
                slug: (problemDraft.slug || slugify(name)).trim(),
                updatedAt: localISODate(new Date()),
              })
            : problem,
        ),
      };
    });
  };

  const deleteProblem = () => {
    if (!selectedProblemId) return;
    setData((prev) => {
      if (!prev || prev.problems.length <= 1) return prev;
      const nextProblems = prev.problems.filter((problem) => problem.id !== selectedProblemId);
      const nextProblemIds = nextProblems.map((problem) => problem.id);
      const nextTreatmentIds = prev.treatments.map((treatment) => treatment.id);
      return {
        ...prev,
        problems: nextProblems,
        clients: prev.clients.map((client) => ({
          ...client,
          skinProfile: {
            ...client.skinProfile,
            problems: client.skinProfile.problems.filter((problemId) => problemId !== selectedProblemId),
          },
        })),
        problemTreatmentLinks: sanitizeProblemTreatmentLinks(
          nextProblemIds,
          nextTreatmentIds,
          prev.problemTreatmentLinks,
        ),
      };
    });
    setSelectedProblemId((current) => {
      if (!data?.problems?.length) return current;
      const next = data.problems.find((problem) => problem.id !== current);
      return next?.id ?? current;
    });
    setActiveView("problems");
  };

  const addTreatment = () => {
    const newTreatment = normalizeTreatment(
      {
        id: uid("t"),
        name: "Нова процедура",
        description: "",
        protocol: "",
        duration: "",
        recovery: "",
        safetyNotes: "",
        status: "active",
      },
      data?.treatments?.length ?? 0,
    );

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        treatments: [newTreatment, ...prev.treatments],
      };
    });
    setSelectedTreatmentId(newTreatment.id);
    setActiveView("treatmentEdit");
  };

  const saveTreatment = (event) => {
    event.preventDefault();
    if (!selectedTreatmentId || !treatmentDraft) return;
    const name = treatmentDraft.name.trim();
    if (!name) return;

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        treatments: prev.treatments.map((treatment) =>
          treatment.id === selectedTreatmentId
            ? normalizeTreatment({
                ...treatment,
                ...treatmentDraft,
                name,
                slug: (treatmentDraft.slug || slugify(name)).trim(),
                updatedAt: localISODate(new Date()),
              })
            : treatment,
        ),
      };
    });
  };

  const deleteTreatment = () => {
    if (!selectedTreatmentId) return;
    setData((prev) => {
      if (!prev || prev.treatments.length <= 1) return prev;
      const nextTreatments = prev.treatments.filter((treatment) => treatment.id !== selectedTreatmentId);
      const nextProblemIds = prev.problems.map((problem) => problem.id);
      const nextTreatmentIds = nextTreatments.map((treatment) => treatment.id);
      return {
        ...prev,
        treatments: nextTreatments,
        problemTreatmentLinks: sanitizeProblemTreatmentLinks(
          nextProblemIds,
          nextTreatmentIds,
          prev.problemTreatmentLinks,
        ),
      };
    });
    setSelectedTreatmentId((current) => {
      if (!data?.treatments?.length) return current;
      const next = data.treatments.find((treatment) => treatment.id !== current);
      return next?.id ?? current;
    });
    setActiveView("treatments");
  };

  const checkItems = useMemo(() => {
    if (!data) return [];
    if (!selectedProblem) return [];
    const linked = new Set(linksForProblem(selectedProblem.id));
    return data.treatments.map((treatment) => ({
      id: treatment.id,
      name: treatment.name,
      checked: linked.has(treatment.id),
    }));
  }, [data, selectedProblem]);

  const startPriceCreate = () => {
    setSelectedPriceId(null);
    setPriceDraft({
      name: "",
      type: "fixed",
      from: "",
      to: "",
    });
    setActiveView("priceEdit");
  };

  const savePriceDraft = (event) => {
    event.preventDefault();
    if (!priceDraft.name.trim() || !priceDraft.from) return;

    const from = Number(priceDraft.from);
    const to = Number(priceDraft.to || priceDraft.from);
    if (Number.isNaN(from)) return;

    if (selectedPriceId) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pricing: prev.pricing.map((entry) =>
            entry.id === selectedPriceId
              ? {
                  ...entry,
                  name: priceDraft.name.trim(),
                  type: priceDraft.type,
                  from,
                  to: priceDraft.type === "range" ? to : null,
                }
              : entry,
          ),
        };
      });
      return;
    }

    const newPrice = {
      id: uid("pr"),
      name: priceDraft.name.trim(),
      type: priceDraft.type,
      from,
      to: priceDraft.type === "range" ? to : null,
    };

    setData((prev) => ({ ...prev, pricing: [newPrice, ...prev.pricing] }));
    setSelectedPriceId(newPrice.id);
  };

  const deletePriceDraft = () => {
    if (!selectedPriceId) {
      setActiveView("pricing");
      return;
    }

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pricing: prev.pricing.filter((entry) => entry.id !== selectedPriceId),
      };
    });
    setActiveView("pricing");
  };

  const addCmsPage = () => {
    const newPage = {
      id: uid("cms"),
      title: "Нова страница",
      slug: "/new-page",
      status: "draft",
      heroTitle: "",
      heroSubtitle: "",
      cta: "",
      metaDescription: "",
      updatedAt: localISODate(new Date()),
    };

    setData((prev) => ({ ...prev, cmsPages: [newPage, ...prev.cmsPages] }));
    setSelectedCmsId(newPage.id);
    setActiveView("cmsEdit");
  };

  const saveCmsPage = (event) => {
    event.preventDefault();
    if (!cmsDraft || !selectedCmsId) return;
    const updatedAt = localISODate(new Date());

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cmsPages: prev.cmsPages.map((page) =>
          page.id === selectedCmsId
            ? {
                ...page,
                ...cmsDraft,
                updatedAt,
              }
            : page,
        ),
      };
    });
  };

  if (!ready || !data) {
    return <main className="app-boot">Зареждане на системата...</main>;
  }

  const parentView = VIEW_PARENTS[activeView] ?? null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand-eyebrow">Obliq</p>
          <h1>Administration</h1>
          <p className="brand-subtitle">Medical Control System</p>
        </div>

        <nav className="main-nav">
          {NAV_ITEMS.map(([view, title]) => (
            <button
              key={view}
              className={`nav-btn ${navView(activeView) === view ? "active" : ""}`}
              onClick={() => setActiveView(view)}
              type="button"
            >
              {title}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <p>Internal use only</p>
          <p>{now}</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="topbar-kicker">Obliq Internal Tool</p>
            <h2 id="view-title">{VIEW_TITLES[activeView] ?? VIEW_TITLES[navView(activeView)]}</h2>
          </div>
          <div className="topbar-actions">
            {parentView && (
              <button className="ghost-btn" type="button" onClick={() => setActiveView(parentView)}>
                Назад към списък
              </button>
            )}
            <button className="ghost-btn" type="button" onClick={addClient}>
              Ново досие
            </button>
            <button className="ghost-btn" type="button" onClick={() => setActiveView("bookingNew")}>
              Нов запис
            </button>
          </div>
        </header>

        {activeView === "dashboard" && (
          <section>
            <div className="grid metrics-grid">
              <article className="card metric-card">
                <p>Днешни записи</p>
                <h3>{todayAppointments.length}</h3>
              </article>
              <article className="card metric-card">
                <p>Нови клиенти (30 дни)</p>
                <h3>{newClientsMetric}</h3>
              </article>
              <article className="card metric-card">
                <p>Активни процедури</p>
                <h3>{activeProceduresMetric}</h3>
              </article>
            </div>

            <div className="grid split-grid">
              <article className="card">
                <div className="card-head">
                  <h3>Днес</h3>
                  <button className="text-btn" onClick={() => setActiveView("calendar")} type="button">
                    Отвори календара
                  </button>
                </div>
                <div className="stack-list">
                  {todayAppointments.length ? (
                    todayAppointments.map((entry) => (
                      <div key={entry.id} className="appointment-row">
                        <strong>
                          {entry.time} · {entry.clientName}
                        </strong>
                        <p>
                          {entry.procedure} · {entry.specialist}
                        </p>
                        <p>{STATUS_LABELS[entry.status]}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyState text="Няма записи за днес." />
                  )}
                </div>
              </article>

              <article className="card">
                <div className="card-head">
                  <h3>Quick Actions</h3>
                </div>
                <div className="quick-actions">
                  <button type="button" onClick={() => setActiveView("clients")}>
                    Преглед на досиета
                  </button>
                  <button type="button" onClick={() => setActiveView("specialists")}>
                    Управление на специалисти
                  </button>
                  <button type="button" onClick={() => setActiveView("problems")}>
                    Управление на проблеми
                  </button>
                  <button type="button" onClick={() => setActiveView("treatments")}>
                    Управление на процедури
                  </button>
                  <button type="button" onClick={() => setActiveView("mapping")}>
                    Управление на релации
                  </button>
                  <button type="button" onClick={() => setActiveView("pricing")}>
                    Редакция на услуги
                  </button>
                  <button type="button" onClick={() => setActiveView("cms")}>
                    Промяна на сайт съдържание
                  </button>
                </div>
              </article>
            </div>
          </section>
        )}

        {(activeView === "clients" || activeView === "clientEdit") && (
          <section>
            {activeView === "clients" && (
              <article className="card client-list-card">
                <div className="card-head">
                  <h3>Клиенти</h3>
                  <button className="text-btn" type="button" onClick={addClient}>
                    + Нов клиент
                  </button>
                </div>

                <input
                  type="search"
                  placeholder="Търси име, телефон..."
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                />

                <div className="client-list">
                  {filteredClients.length ? (
                    filteredClients.map((client) => (
                      <button
                        key={client.id}
                        className={`client-list-item ${selectedClientId === client.id ? "active" : ""}`}
                        type="button"
                        onClick={() => openClientEditor(client.id)}
                      >
                        <h4>{client.name}</h4>
                        <p>
                          {client.phone || "Без телефон"} · Първо посещение: {formatDate(client.firstVisit)}
                        </p>
                      </button>
                    ))
                  ) : (
                    <EmptyState />
                  )}
                </div>
              </article>
            )}

            {activeView === "clientEdit" && (
              <article className="card dossier-card">
                {!selectedClient ? (
                  <EmptyState text="Избери клиент за преглед." />
                ) : (
                  <>
                    <div className="card-head">
                      <h3>Редакция на досие</h3>
                      <button className="text-btn" type="button" onClick={() => setActiveView("clients")}>
                        Назад към списък
                      </button>
                    </div>

                    <div className="dossier-header">
                      <h3>{selectedClient.name}</h3>
                      <p>
                        {selectedClient.email || "Без email"} · {selectedClient.phone || "Без телефон"}
                      </p>
                    </div>

                  <div className="dossier-tabs">
                    {[
                      ["overview", "Обобщение"],
                      ["skin", "Skin Profile"],
                      ["history", "История"],
                      ["notes", "Бележки"],
                    ].map(([tab, label]) => (
                      <button
                        key={tab}
                        className={`dossier-tab ${clientTab === tab ? "active" : ""}`}
                        type="button"
                        onClick={() => setClientTab(tab)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {clientTab === "overview" && (
                    <section>
                      <div className="field-grid">
                        <div className="control-row">
                          <label>Име</label>
                          <input
                            value={selectedClient.name}
                            onChange={(event) =>
                              updateClient(selectedClient.id, (client) => ({
                                ...client,
                                name: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="control-row">
                          <label>Телефон</label>
                          <input
                            value={selectedClient.phone}
                            onChange={(event) =>
                              updateClient(selectedClient.id, (client) => ({
                                ...client,
                                phone: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="control-row">
                          <label>Email</label>
                          <input
                            value={selectedClient.email}
                            onChange={(event) =>
                              updateClient(selectedClient.id, (client) => ({
                                ...client,
                                email: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="control-row">
                          <label>Рождена дата</label>
                          <input
                            type="date"
                            value={selectedClient.dob || ""}
                            onChange={(event) =>
                              updateClient(selectedClient.id, (client) => ({
                                ...client,
                                dob: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="control-row">
                          <label>Първо посещение</label>
                          <input
                            type="date"
                            value={selectedClient.firstVisit || ""}
                            onChange={(event) =>
                              updateClient(selectedClient.id, (client) => ({
                                ...client,
                                firstVisit: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="control-row">
                          <label>Водещ лекар</label>
                          <select
                            value={selectedClient.assignedSpecialist || ""}
                            onChange={(event) =>
                              updateClient(selectedClient.id, (client) => ({
                                ...client,
                                assignedSpecialist: event.target.value,
                              }))
                            }
                          >
                            {data.specialists.map((person) => (
                              <option key={person.id} value={person.name}>
                                {person.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="control-row">
                        <label>Активни проблеми</label>
                        <div className="pills">
                          {selectedClient.skinProfile.problems.length ? (
                            selectedClient.skinProfile.problems.map((problemId) => (
                              <span key={problemId} className="pill">
                                {problemById.get(problemId)?.name ?? problemId}
                              </span>
                            ))
                          ) : (
                            <span className="pill">Няма избрани</span>
                          )}
                        </div>
                      </div>

                      <div className="control-row">
                        <label>Препоръки</label>
                        <div className="pills">
                          {selectedClient.recommendations.length ? (
                            selectedClient.recommendations.map((recommendation, index) => (
                              <span key={`${recommendation}-${index}`} className="pill">
                                {recommendation}
                              </span>
                            ))
                          ) : (
                            <span className="pill">Няма добавени</span>
                          )}
                        </div>
                      </div>

                      <div className="field-grid">
                        <div className="control-row">
                          <label>Добави препоръка</label>
                          <input
                            placeholder="Например: Контрол след 4 седмици"
                            value={newRecommendation}
                            onChange={(event) => setNewRecommendation(event.target.value)}
                          />
                        </div>
                        <div className="control-row">
                          <label>&nbsp;</label>
                          <button type="button" onClick={addRecommendation}>
                            Добави
                          </button>
                        </div>
                      </div>
                    </section>
                  )}

                  {clientTab === "skin" && (
                    <section>
                      <div className="field-grid">
                        <div className="control-row">
                          <label>Тип кожа</label>
                          <select
                            value={selectedClient.skinProfile.type}
                            onChange={(event) =>
                              updateClient(selectedClient.id, (client) => ({
                                ...client,
                                skinProfile: {
                                  ...client.skinProfile,
                                  type: event.target.value,
                                },
                              }))
                            }
                          >
                            {["Суха", "Мазна", "Комбинирана", "Нормална", "Зряла"].map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="control-row">
                          <label>Чувствителност</label>
                          <select
                            value={selectedClient.skinProfile.sensitivity}
                            onChange={(event) =>
                              updateClient(selectedClient.id, (client) => ({
                                ...client,
                                skinProfile: {
                                  ...client.skinProfile,
                                  sensitivity: event.target.value,
                                },
                              }))
                            }
                          >
                            {["Ниска", "Средна", "Висока"].map((level) => (
                              <option key={level} value={level}>
                                {level}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="control-row">
                        <label>Проблеми (multi-select)</label>
                        <div className="check-grid">
                          {data.problems.map((problem) => (
                            <label key={problem.id}>
                              <input
                                type="checkbox"
                                checked={selectedClient.skinProfile.problems.includes(problem.id)}
                                onChange={(event) => updateSkinProblem(problem.id, event.target.checked)}
                              />
                              <span>{problem.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="control-row">
                        <label>Бележки от специалист</label>
                        <textarea
                          value={selectedClient.skinProfile.notes || ""}
                          onChange={(event) =>
                            updateClient(selectedClient.id, (client) => ({
                              ...client,
                              skinProfile: {
                                ...client.skinProfile,
                                notes: event.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </section>
                  )}

                  {clientTab === "history" && (
                    <section>
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>Дата</th>
                            <th>Процедура</th>
                            <th>Лекар</th>
                            <th>Бележки</th>
                            <th>Резултат</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...selectedClient.visits]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((visit) => (
                              <tr key={visit.id}>
                                <td>{formatDate(visit.date)}</td>
                                <td>{visit.procedure}</td>
                                <td>{visit.doctor}</td>
                                <td>{visit.notes}</td>
                                <td>{visit.result}</td>
                              </tr>
                            ))}
                          {!selectedClient.visits.length && (
                            <tr>
                              <td colSpan={5}>Няма посещения.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      <form className="small-form" onSubmit={submitVisit}>
                        <div className="field-grid">
                          <div className="control-row">
                            <label>Дата</label>
                            <input
                              type="date"
                              value={visitForm.date}
                              onChange={(event) => setVisitForm((prev) => ({ ...prev, date: event.target.value }))}
                              required
                            />
                          </div>
                          <div className="control-row">
                            <label>Процедура</label>
                            <input
                              value={visitForm.procedure}
                              onChange={(event) =>
                                setVisitForm((prev) => ({ ...prev, procedure: event.target.value }))
                              }
                              required
                            />
                          </div>
                          <div className="control-row">
                            <label>Лекар</label>
                            <select
                              value={visitForm.doctor}
                              onChange={(event) => setVisitForm((prev) => ({ ...prev, doctor: event.target.value }))}
                            >
                              {data.specialists.map((person) => (
                                <option key={person.id} value={person.name}>
                                  {person.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="field-grid">
                          <div className="control-row">
                            <label>Бележки</label>
                            <input
                              value={visitForm.notes}
                              onChange={(event) => setVisitForm((prev) => ({ ...prev, notes: event.target.value }))}
                              required
                            />
                          </div>
                          <div className="control-row">
                            <label>Резултат</label>
                            <input
                              value={visitForm.result}
                              onChange={(event) => setVisitForm((prev) => ({ ...prev, result: event.target.value }))}
                              required
                            />
                          </div>
                          <div className="control-row">
                            <label>&nbsp;</label>
                            <button type="submit">Добави посещение</button>
                          </div>
                        </div>
                      </form>
                    </section>
                  )}

                  {clientTab === "notes" && (
                    <section>
                      <div className="timeline">
                        {[...selectedClient.notes]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((note) => (
                            <div key={note.id} className={`timeline-item ${note.important ? "important" : ""}`}>
                              <strong>
                                {formatDate(note.date)}
                                {note.important ? " · важно" : ""}
                              </strong>
                              <p>{note.text}</p>
                            </div>
                          ))}
                        {!selectedClient.notes.length && <EmptyState text="Няма бележки." />}
                      </div>

                      <form className="small-form" onSubmit={submitNote}>
                        <div className="control-row">
                          <label>Нова бележка</label>
                          <textarea
                            value={noteForm.text}
                            onChange={(event) => setNoteForm((prev) => ({ ...prev, text: event.target.value }))}
                            required
                          />
                        </div>
                        <div className="control-row">
                          <label>
                            <input
                              type="checkbox"
                              checked={noteForm.important}
                              onChange={(event) => setNoteForm((prev) => ({ ...prev, important: event.target.checked }))}
                            />{" "}
                            Маркирай като важно
                          </label>
                        </div>
                        <button type="submit">Добави бележка</button>
                      </form>
                    </section>
                  )}
                  </>
                )}
              </article>
            )}
          </section>
        )}

        {activeView === "calendar" && (
          <section>
            <article className="card calendar-filters">
              <div className="control-row">
                <label>Изглед</label>
                <select value={calendarMode} onChange={(event) => setCalendarMode(event.target.value)}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                </select>
              </div>
              <div className="control-row">
                <label>Дата</label>
                <input type="date" value={calendarDate} onChange={(event) => setCalendarDate(event.target.value)} />
              </div>
              <div className="control-row">
                <label>Специалист</label>
                <select value={calendarSpecialist} onChange={(event) => setCalendarSpecialist(event.target.value)}>
                  <option value="all">Всички</option>
                  {data.specialists.map((person) => (
                    <option key={person.id} value={person.name}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="control-row">
                <label>Статус</label>
                <select value={calendarStatus} onChange={(event) => setCalendarStatus(event.target.value)}>
                  <option value="all">Всички</option>
                  <option value="booked">Записан</option>
                  <option value="confirmed">Потвърден</option>
                  <option value="canceled">Отменен</option>
                </select>
              </div>
            </article>

            <article className="card calendar-board-wrap">
              <div className="status-legend">
                <span className="tag booked">Записан</span>
                <span className="tag confirmed">Потвърден</span>
                <span className="tag canceled">Отменен</span>
              </div>

              <div className="calendar-board">
                <table className="calendar-table">
                  <thead>
                    <tr>
                      <th></th>
                      {calendarDates.map((date) => (
                        <th key={date}>
                          {dayLabel(date)}
                          <br />
                          {formatDate(date)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CALENDAR_TIMES.map((time) => (
                      <tr key={time}>
                        <td className="time-col">{time}</td>
                        {calendarDates.map((date) => {
                          const key = `${date}-${time}`;
                          const appointments = appointmentsForSlot(date, time);
                          return (
                            <td key={key}>
                              <div
                                className={`drop-cell ${hoverCell === key ? "over" : ""}`}
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  setHoverCell(key);
                                }}
                                onDragLeave={() => {
                                  setHoverCell((prev) => (prev === key ? "" : prev));
                                }}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  const appointmentId = event.dataTransfer.getData("text/plain");
                                  setHoverCell("");
                                  if (appointmentId) {
                                    moveAppointment(appointmentId, date, time);
                                  }
                                }}
                              >
                                {appointments.map((appointment) => (
                                  <article
                                    key={appointment.id}
                                    className="appointment-card"
                                    draggable
                                    onDragStart={(event) => {
                                      event.dataTransfer.setData("text/plain", appointment.id);
                                      event.dataTransfer.effectAllowed = "move";
                                    }}
                                  >
                                    <strong>{appointment.clientName}</strong>
                                    <p>{appointment.procedure}</p>
                                    <p>{appointment.specialist}</p>
                                    <select
                                      value={appointment.status}
                                      onChange={(event) =>
                                        updateAppointmentStatus(appointment.id, event.target.value)
                                      }
                                    >
                                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>
                                          {label}
                                        </option>
                                      ))}
                                    </select>
                                  </article>
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {activeView === "bookingNew" && (
          <section>
            <article className="card">
              <div className="card-head">
                <h3>Нов запис</h3>
              </div>
              <form className="booking-form" onSubmit={submitBooking}>
                <div className="control-row">
                  <label>Тип клиент</label>
                  <select
                    value={bookingForm.kind}
                    onChange={(event) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        kind: event.target.value,
                        procedure:
                          event.target.value === "new" ? "Консултация" : data.treatments[0]?.name ?? "Консултация",
                      }))
                    }
                  >
                    <option value="existing">Съществуващ</option>
                    <option value="new">Нов</option>
                  </select>
                </div>

                {bookingForm.kind === "existing" ? (
                  <div className="control-row">
                    <label>Клиент</label>
                    <select
                      value={bookingForm.existingClientId}
                      onChange={(event) =>
                        setBookingForm((prev) => ({
                          ...prev,
                          existingClientId: event.target.value,
                        }))
                      }
                    >
                      {data.clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="control-row">
                    <label>Име</label>
                    <input
                      placeholder="Име на нов клиент"
                      value={bookingForm.newClientName}
                      onChange={(event) =>
                        setBookingForm((prev) => ({
                          ...prev,
                          newClientName: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                )}

                <div className="control-row">
                  <label>Процедура</label>
                  <select
                    value={bookingForm.kind === "new" ? "Консултация" : bookingForm.procedure}
                    disabled={bookingForm.kind === "new"}
                    onChange={(event) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        procedure: event.target.value,
                      }))
                    }
                  >
                    {proceduresForBooking.map((procedure) => (
                      <option key={procedure} value={procedure}>
                        {procedure}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="control-row">
                  <label>Дата</label>
                  <input
                    type="date"
                    value={bookingForm.date}
                    onChange={(event) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        date: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="control-row">
                  <label>Час</label>
                  <select
                    value={bookingForm.time}
                    onChange={(event) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        time: event.target.value,
                      }))
                    }
                  >
                    {CALENDAR_TIMES.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="control-row">
                  <label>Специалист</label>
                  <select
                    value={bookingForm.specialist}
                    onChange={(event) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        specialist: event.target.value,
                      }))
                    }
                  >
                    {data.specialists.map((person) => (
                      <option key={person.id} value={person.name}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit">Добави запис</button>
              </form>
              <p className="muted-note">{bookingMessage}</p>
            </article>
          </section>
        )}

        {activeView === "specialists" && (
          <section>
            <article className="card selector-card">
              <div className="card-head">
                <h3>Специалисти</h3>
                <button type="button" className="text-btn" onClick={addSpecialist}>
                  + Нов
                </button>
              </div>
              <div className="choice-list">
                {data.specialists.map((specialist) => {
                  const clientCount = data.clients.filter((client) => client.assignedSpecialist === specialist.name).length;
                  const appointmentCount = data.appointments.filter(
                    (appointment) => appointment.specialist === specialist.name,
                  ).length;
                  return (
                    <button
                      key={specialist.id}
                      className={`choice-item ${selectedSpecialistId === specialist.id ? "active" : ""}`}
                      type="button"
                      onClick={() => openSpecialistEditor(specialist.id)}
                    >
                      <strong>{specialist.name}</strong>
                      <p>
                        {specialist.role} · {specialist.status === "active" ? "Активен" : "Архив"}
                      </p>
                      <p>
                        Клиенти: {clientCount} · Записи: {appointmentCount}
                      </p>
                    </button>
                  );
                })}
              </div>
            </article>
          </section>
        )}

        {activeView === "specialistEdit" && (
          <section>
            <article className="card editor-card">
              {!selectedSpecialist || !specialistDraft ? (
                <EmptyState text="Избери специалист за редакция." />
              ) : (
                <form className="entity-form" onSubmit={saveSpecialist}>
                  <div className="card-head">
                    <h3>Профил на специалист</h3>
                    <button type="button" className="text-btn" onClick={() => setActiveView("specialists")}>
                      Назад към списък
                    </button>
                  </div>
                  <div className="field-grid">
                    <div className="control-row">
                      <label>Име</label>
                      <input
                        value={specialistDraft.name}
                        onChange={(event) =>
                          setSpecialistDraft((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="control-row">
                      <label>Роля</label>
                      <input
                        value={specialistDraft.role}
                        onChange={(event) =>
                          setSpecialistDraft((prev) => ({
                            ...prev,
                            role: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="control-row">
                      <label>Телефон</label>
                      <input
                        value={specialistDraft.phone}
                        onChange={(event) =>
                          setSpecialistDraft((prev) => ({
                            ...prev,
                            phone: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="control-row">
                      <label>Email</label>
                      <input
                        type="email"
                        value={specialistDraft.email}
                        onChange={(event) =>
                          setSpecialistDraft((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="control-row">
                      <label>Статус</label>
                      <select
                        value={specialistDraft.status}
                        onChange={(event) =>
                          setSpecialistDraft((prev) => ({
                            ...prev,
                            status: event.target.value,
                          }))
                        }
                      >
                        <option value="active">Активен</option>
                        <option value="archived">Архив</option>
                      </select>
                    </div>
                    <div className="control-row">
                      <label>Последна промяна</label>
                      <input value={formatDate(selectedSpecialist.updatedAt)} readOnly />
                    </div>
                  </div>
                  <div className="control-row">
                    <label>Вътрешни бележки</label>
                    <textarea
                      rows={4}
                      value={specialistDraft.notes}
                      onChange={(event) =>
                        setSpecialistDraft((prev) => ({
                          ...prev,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="editor-actions">
                    <button type="submit">Запази специалист</button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={deleteSpecialist}
                      disabled={data.specialists.length <= 1}
                    >
                      Изтрий специалист
                    </button>
                  </div>
                </form>
              )}
            </article>
          </section>
        )}

        {activeView === "problems" && (
          <section>
            <article className="card selector-card">
              <div className="card-head">
                <h3>Проблеми</h3>
                <button type="button" className="text-btn" onClick={addProblem}>
                  + Нов
                </button>
              </div>
              <div className="choice-list">
                {data.problems.map((problem) => {
                  const relationCount = linksForProblem(problem.id).length;
                  return (
                    <button
                      key={problem.id}
                      className={`choice-item ${selectedProblemId === problem.id ? "active" : ""}`}
                      type="button"
                      onClick={() => openProblemEditor(problem.id)}
                    >
                      <strong>{problem.name}</strong>
                      <p>{problem.description || "Без описание."}</p>
                      <p>
                        Статус: {problem.status === "active" ? "Активен" : "Архив"} · Релации: {relationCount}
                      </p>
                    </button>
                  );
                })}
              </div>
            </article>
          </section>
        )}

        {activeView === "problemEdit" && (
          <section>
            <article className="card editor-card">
              {!selectedProblem || !problemDraft ? (
                <EmptyState text="Избери проблем за редакция." />
              ) : (
                <form className="entity-form" onSubmit={saveProblem}>
                  <div className="card-head">
                    <h3>Редакция на проблем</h3>
                    <button type="button" className="text-btn" onClick={() => setActiveView("problems")}>
                      Назад към списък
                    </button>
                  </div>
                  <div className="field-grid">
                    <div className="control-row">
                      <label>Име</label>
                      <input
                        value={problemDraft.name}
                        onChange={(event) =>
                          setProblemDraft((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="control-row">
                      <label>Slug</label>
                      <input
                        value={problemDraft.slug}
                        onChange={(event) =>
                          setProblemDraft((prev) => ({
                            ...prev,
                            slug: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="control-row">
                      <label>Статус</label>
                      <select
                        value={problemDraft.status}
                        onChange={(event) =>
                          setProblemDraft((prev) => ({
                            ...prev,
                            status: event.target.value,
                          }))
                        }
                      >
                        <option value="active">Активен</option>
                        <option value="archived">Архив</option>
                      </select>
                    </div>
                    <div className="control-row">
                      <label>Последна промяна</label>
                      <input value={formatDate(selectedProblem.updatedAt)} readOnly />
                    </div>
                  </div>

                  <div className="control-row">
                    <label>Кратко описание</label>
                    <textarea
                      rows={3}
                      value={problemDraft.description}
                      onChange={(event) =>
                        setProblemDraft((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="control-row">
                    <label>Клиничен overview</label>
                    <textarea
                      rows={3}
                      value={problemDraft.clinicalOverview}
                      onChange={(event) =>
                        setProblemDraft((prev) => ({
                          ...prev,
                          clinicalOverview: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="control-row">
                    <label>Засегнати зони</label>
                    <input
                      value={problemDraft.affectedZones}
                      onChange={(event) =>
                        setProblemDraft((prev) => ({
                          ...prev,
                          affectedZones: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="control-row">
                    <label>Бележки за оценка</label>
                    <textarea
                      rows={3}
                      value={problemDraft.assessmentNotes}
                      onChange={(event) =>
                        setProblemDraft((prev) => ({
                          ...prev,
                          assessmentNotes: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="editor-actions">
                    <button type="submit">Запази проблем</button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={deleteProblem}
                      disabled={data.problems.length <= 1}
                    >
                      Изтрий проблем
                    </button>
                  </div>
                </form>
              )}
            </article>
          </section>
        )}

        {activeView === "treatments" && (
          <section>
            <article className="card selector-card">
              <div className="card-head">
                <h3>Процедури</h3>
                <button type="button" className="text-btn" onClick={addTreatment}>
                  + Нова
                </button>
              </div>
              <div className="choice-list">
                {data.treatments.map((treatment) => {
                  const relationCount = data.problems.filter((problem) =>
                    linksForProblem(problem.id).includes(treatment.id),
                  ).length;
                  return (
                    <button
                      key={treatment.id}
                      className={`choice-item ${selectedTreatmentId === treatment.id ? "active" : ""}`}
                      type="button"
                      onClick={() => openTreatmentEditor(treatment.id)}
                    >
                      <strong>{treatment.name}</strong>
                      <p>{treatment.description || "Без описание."}</p>
                      <p>
                        Статус: {treatment.status === "active" ? "Активна" : "Архив"} · Релации: {relationCount}
                      </p>
                    </button>
                  );
                })}
              </div>
            </article>
          </section>
        )}

        {activeView === "treatmentEdit" && (
          <section>
            <article className="card editor-card">
              {!selectedTreatment || !treatmentDraft ? (
                <EmptyState text="Избери процедура за редакция." />
              ) : (
                <form className="entity-form" onSubmit={saveTreatment}>
                  <div className="card-head">
                    <h3>Редакция на процедура</h3>
                    <button type="button" className="text-btn" onClick={() => setActiveView("treatments")}>
                      Назад към списък
                    </button>
                  </div>
                  <div className="field-grid">
                    <div className="control-row">
                      <label>Име</label>
                      <input
                        value={treatmentDraft.name}
                        onChange={(event) =>
                          setTreatmentDraft((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="control-row">
                      <label>Slug</label>
                      <input
                        value={treatmentDraft.slug}
                        onChange={(event) =>
                          setTreatmentDraft((prev) => ({
                            ...prev,
                            slug: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="control-row">
                      <label>Статус</label>
                      <select
                        value={treatmentDraft.status}
                        onChange={(event) =>
                          setTreatmentDraft((prev) => ({
                            ...prev,
                            status: event.target.value,
                          }))
                        }
                      >
                        <option value="active">Активна</option>
                        <option value="archived">Архив</option>
                      </select>
                    </div>
                    <div className="control-row">
                      <label>Последна промяна</label>
                      <input value={formatDate(selectedTreatment.updatedAt)} readOnly />
                    </div>
                  </div>

                  <div className="control-row">
                    <label>Описание на резултат</label>
                    <textarea
                      rows={3}
                      value={treatmentDraft.description}
                      onChange={(event) =>
                        setTreatmentDraft((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="control-row">
                    <label>Протокол</label>
                    <textarea
                      rows={3}
                      value={treatmentDraft.protocol}
                      onChange={(event) =>
                        setTreatmentDraft((prev) => ({
                          ...prev,
                          protocol: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field-grid">
                    <div className="control-row">
                      <label>Продължителност</label>
                      <input
                        value={treatmentDraft.duration}
                        onChange={(event) =>
                          setTreatmentDraft((prev) => ({
                            ...prev,
                            duration: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="control-row">
                      <label>Възстановяване</label>
                      <input
                        value={treatmentDraft.recovery}
                        onChange={(event) =>
                          setTreatmentDraft((prev) => ({
                            ...prev,
                            recovery: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="control-row">
                    <label>Safety notes</label>
                    <textarea
                      rows={3}
                      value={treatmentDraft.safetyNotes}
                      onChange={(event) =>
                        setTreatmentDraft((prev) => ({
                          ...prev,
                          safetyNotes: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="editor-actions">
                    <button type="submit">Запази процедура</button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={deleteTreatment}
                      disabled={data.treatments.length <= 1}
                    >
                      Изтрий процедура
                    </button>
                  </div>
                </form>
              )}
            </article>
          </section>
        )}

        {activeView === "mapping" && (
          <section>
            <div className="grid content-grid">
              <article className="card selector-card">
                <div className="card-head">
                  <h3>Проблеми</h3>
                </div>
                <div className="choice-list">
                  {data.problems.map((problem) => (
                    <button
                      key={problem.id}
                      className={`choice-item ${selectedProblemId === problem.id ? "active" : ""}`}
                      type="button"
                      onClick={() => setSelectedProblemId(problem.id)}
                    >
                      <strong>{problem.name}</strong>
                      <p>{problem.description || "Без описание."}</p>
                    </button>
                  ))}
                </div>
              </article>

              <article className="card">
                <div className="card-head">
                  <h3>Свързани процедури</h3>
                </div>
                <p className="muted-note">
                  Избери процедури за: <strong>{selectedProblem?.name ?? "-"}</strong>
                </p>
                <div className="check-grid">
                  {checkItems.map((item) => (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => {
                          if (!selectedProblem) return;
                          setLink(selectedProblem.id, item.id, event.target.checked);
                        }}
                      />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              </article>
            </div>
          </section>
        )}

        {activeView === "pricing" && (
          <section>
            <article className="card">
              <div className="card-head">
                <h3>Услуги и цени</h3>
                <button type="button" className="text-btn" onClick={startPriceCreate}>
                  + Нова услуга
                </button>
              </div>
              <p className="muted-note">
                Ценоразписът е структуриран само по фиксирани услуги и ценови модел, без количества или мерни единици.
              </p>
              <div id="pricing-table">
                {data.pricing.length ? (
                  <table className="pricing-table">
                    <thead>
                      <tr>
                        <th>Услуга</th>
                        <th>Тип</th>
                        <th>Цена</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pricing.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.name}</td>
                          <td>{entry.type === "range" ? "Диапазон" : "Фиксирана"}</td>
                          <td className="price-cell">{formatPrice(entry)}</td>
                          <td>
                            <button type="button" className="text-btn" onClick={() => openPriceEditor(entry.id)}>
                              Редакция
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState text="Няма добавени услуги." />
                )}
              </div>
            </article>
          </section>
        )}

        {activeView === "priceEdit" && (
          <section>
            <article className="card">
              <div className="card-head">
                <h3>{selectedPriceId ? "Редакция на услуга" : "Нова услуга"}</h3>
                <button type="button" className="text-btn" onClick={() => setActiveView("pricing")}>
                  Назад към списък
                </button>
              </div>

              <form className="pricing-form" onSubmit={savePriceDraft}>
                <div className="control-row">
                  <label>Име на услуга</label>
                  <input
                    required
                    value={priceDraft.name}
                    onChange={(event) => setPriceDraft((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="control-row">
                  <label>Тип цена</label>
                  <select
                    value={priceDraft.type}
                    onChange={(event) => setPriceDraft((prev) => ({ ...prev, type: event.target.value }))}
                  >
                    <option value="fixed">Фиксирана</option>
                    <option value="range">Диапазон</option>
                  </select>
                </div>
                <div className="control-row">
                  <label>Цена от (лв.)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={priceDraft.from}
                    onChange={(event) => setPriceDraft((prev) => ({ ...prev, from: event.target.value }))}
                  />
                </div>
                {priceDraft.type === "range" && (
                  <div className="control-row">
                    <label>Цена до (лв.)</label>
                    <input
                      type="number"
                      min="0"
                      value={priceDraft.to}
                      onChange={(event) => setPriceDraft((prev) => ({ ...prev, to: event.target.value }))}
                    />
                  </div>
                )}
                <div className="editor-actions">
                  <button type="submit">Запази услуга</button>
                  <button type="button" className="danger-btn" onClick={deletePriceDraft}>
                    {selectedPriceId ? "Изтрий услуга" : "Откажи"}
                  </button>
                </div>
              </form>
            </article>
          </section>
        )}

        {activeView === "cms" && (
          <section>
            <article className="card cms-list-card">
              <div className="card-head">
                <h3>CMS Страници</h3>
                <button type="button" className="text-btn" onClick={addCmsPage}>
                  + Нова страница
                </button>
              </div>
              <div className="choice-list">
                {data.cmsPages.map((page) => (
                  <button
                    key={page.id}
                    className={`choice-item ${selectedCmsId === page.id ? "active" : ""}`}
                    type="button"
                    onClick={() => openCmsEditor(page.id)}
                  >
                    <strong>
                      <span className={`status-dot ${page.status === "live" ? "live" : "draft"}`} />
                      {page.title}
                    </strong>
                    <p>
                      {page.slug} · Редактирано: {formatDate(page.updatedAt)}
                    </p>
                  </button>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeView === "cmsEdit" && (
          <section>
            <article className="card cms-editor-card">
              {!selectedCmsPage || !cmsDraft ? (
                <EmptyState />
              ) : (
                <>
                  <div className="card-head">
                    <h3>{selectedCmsPage.title}</h3>
                    <button type="button" className="text-btn" onClick={() => setActiveView("cms")}>
                      Назад към списък
                    </button>
                  </div>
                  <p className="muted-note">
                    {selectedCmsPage.slug} · Последна промяна: {formatDate(selectedCmsPage.updatedAt)}
                  </p>

                  <form onSubmit={saveCmsPage}>
                    <div className="control-row">
                      <label>Име на страница</label>
                      <input
                        value={cmsDraft.title}
                        onChange={(event) => setCmsDraft((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </div>
                    <div className="control-row">
                      <label>Hero заглавие</label>
                      <input
                        value={cmsDraft.heroTitle}
                        onChange={(event) => setCmsDraft((prev) => ({ ...prev, heroTitle: event.target.value }))}
                      />
                    </div>
                    <div className="control-row">
                      <label>Hero подзаглавие</label>
                      <textarea
                        rows={3}
                        value={cmsDraft.heroSubtitle}
                        onChange={(event) => setCmsDraft((prev) => ({ ...prev, heroSubtitle: event.target.value }))}
                      />
                    </div>
                    <div className="control-row">
                      <label>CTA</label>
                      <input
                        value={cmsDraft.cta}
                        onChange={(event) => setCmsDraft((prev) => ({ ...prev, cta: event.target.value }))}
                      />
                    </div>
                    <div className="control-row">
                      <label>Meta описание</label>
                      <textarea
                        rows={3}
                        value={cmsDraft.metaDescription}
                        onChange={(event) =>
                          setCmsDraft((prev) => ({
                            ...prev,
                            metaDescription: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="control-row">
                      <label>Статус</label>
                      <select
                        value={cmsDraft.status}
                        onChange={(event) => setCmsDraft((prev) => ({ ...prev, status: event.target.value }))}
                      >
                        <option value="draft">Чернова</option>
                        <option value="live">Публикувана</option>
                      </select>
                    </div>
                    <button type="submit">Запази промени</button>
                  </form>
                </>
              )}
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
