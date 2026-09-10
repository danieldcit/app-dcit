import type { FaqCategory } from "./faq-content";

// English translation of faq-content.ts — same rationale as the web app's
// faq-content.en.ts (parallel array, not run through the t() dictionary,
// since this is long-form content rather than short chrome labels).
export const FAQ_CATEGORIES_EN: FaqCategory[] = [
  {
    title: "Time Clock",
    items: [
      {
        question: "How do I clock in/out?",
        answer:
          'Tap "Clock In/Out" on the home screen. Each tap records a timestamp, and the system alternates entry and exit automatically (1st tap = clock in, 2nd = clock out, and so on) — so it\'s important not to skip a punch.',
      },
      {
        question: "What if I clock in/out without internet?",
        answer:
          "The punch is recorded normally with the real time of the moment, even offline. As soon as the phone reconnects, it syncs on its own — meanwhile, a notice shows how many punches are waiting to sync.",
      },
      {
        question: "Where do I see my clock punches?",
        answer:
          'In "Time Clock History" (each individual punch) or "Timesheet" (hours grouped by day, with total worked and PDF export).',
      },
      {
        question: "I forgot to clock in/out or punched at the wrong time. What do I do?",
        answer:
          'Use "Adjust my time clock" and describe what needs to be corrected. The request goes to your manager or HR for approval — it doesn\'t fix the punch by itself, it just records what happened for whoever decides. Track the status in "Adjustment requests".',
      },
      {
        question: "What is the Overtime Bank?",
        answer:
          "It's the difference between the hours you were supposed to work and the hours you actually worked, calculated automatically from your clock punches — no manual entry. It shows your balance (positive or negative), estimated weekly rest pay, and the value of overtime hours. With a positive balance, you can request time off in lieu, which also goes through manager/HR approval.",
      },
    ],
  },
  {
    title: "Vacation",
    items: [
      {
        question: "How do I request vacation?",
        answer:
          'On the Vacation screen, choose the start and end dates of the period and submit. The request stays "Pending" until your manager or HR approves or declines it.',
      },
      {
        question: "What are the accrual period and the concession period?",
        answer:
          'These are deadlines set by Brazilian labor law (CLT): the accrual period is the year in which you "earn the right" to vacation, counted from your hire date; the concession period is the following year, the deadline to actually take it. The Vacation screen shows these dates and warns when the concession deadline is close — expired vacation pays double.',
      },
      {
        question: "Where do I see vacation I already took before?",
        answer: 'In "Vacation History", on the Vacation screen itself.',
      },
    ],
  },
  {
    title: "Documents",
    items: [
      {
        question: "Which onboarding documents do I need to send?",
        answer:
          "National ID, CPF, proof of address, marriage certificate and children's birth certificates (when applicable) — up to 3 photos per document. Each one is reviewed by a manager or HR; if it's rejected, you resend the photos and it goes back for review.",
      },
      {
        question: "How do I submit a medical certificate?",
        answer:
          "Take a photo of the certificate — the system reads it automatically (OCR) and fills in the diagnosis code, doctor's license number, doctor's name and days off for you to check before submitting. For privacy, only HR sees the clinical data; your manager only sees that you're out and for how many days.",
      },
      {
        question: "Where do I see my payslip?",
        answer:
          "In the Payslips tab, inside Documents. HR publishes it and you only view it — you can expand the amounts (gross, social security, income tax, benefits, net) and download it as a PDF.",
      },
      {
        question: "How do I submit my signed contract?",
        answer:
          "In the Contract tab, upload the signed file. This submission doesn't go through approval — it's just a record that it was sent.",
      },
      {
        question: "Do certifications go through approval?",
        answer:
          "No. It's a personal record you enter yourself (name, institution, expiration), with no HR review.",
      },
    ],
  },
  {
    title: "Onboarding",
    items: [
      {
        question: "What do I need to do during onboarding?",
        answer:
          "Five steps: sign the contract, submit onboarding documents, watch the welcome video, meet the team, and check off the configured access items (SGN Portal, Movidesk, corporate email, Teams and Site24x7).",
      },
      {
        question: "I finished all the steps — why don't I have full access yet?",
        answer:
          "Completing the 5 steps doesn't grant access by itself: your manager or HR needs to manually release it after reviewing everything. You'll get a notification as soon as that happens.",
      },
    ],
  },
  {
    title: "Benefits",
    items: [
      {
        question: "What shows up on the Benefits screen?",
        answer:
          "Your meal-voucher and transit-voucher balance (current amount and monthly credit), plus the perks club — partners offering discounts, for reference only, not redeemable through the app.",
      },
    ],
  },
  {
    title: "Notice Board & Notifications",
    items: [
      {
        question: "Can I post on the notice board?",
        answer:
          "Only managers and HR post announcements. As an employee, you can view posts, react with ❤️, and see who has a birthday this month.",
      },
      {
        question: "When do I get notifications?",
        answer:
          "In these situations: payment deposited, forgotten clock punch, new notice board post, status change on one of your documents, an onboarding step completed (for manager/HR), access released, and career progression.",
      },
    ],
  },
  {
    title: "My Account",
    items: [
      {
        question: "How do I change my profile photo?",
        answer:
          'On the Profile screen, tap the pencil over the photo and choose "Take photo", "Gallery" or "Remove photo".',
      },
      {
        question: "How do I change my password?",
        answer: 'On the Profile screen, tap "Change password" and enter your current and new password.',
      },
      {
        question: "How do I update my personal data (address, phone, etc.)?",
        answer:
          'On the Profile screen, tap "My Profile". You can edit national ID, date of birth, marital status, phone and address — name, role and salary remain exclusive to HR/manager.',
      },
    ],
  },
  {
    title: "For managers and HR",
    roles: ["gestor", "rh"],
    items: [
      {
        question: "What shows up in Approvals?",
        answer:
          "A single queue with pending requests for medical certificates, vacation, time-clock adjustments, and overtime bank compensation — all in one place, with a history of what's already been decided.",
      },
      {
        question: "How do I manage employees?",
        answer:
          "In Employees, you register and edit data (role, team, level, agreement, salary, expected schedule, etc.) and access the Trash for removed employees.",
      },
      {
        question: "What is the Shift Schedule?",
        answer:
          "A weekly board where you assign shifts to employees on specific dates, navigating week by week.",
      },
      {
        question: "What is Career Management?",
        answer:
          "A career evaluation, exclusive to managers: you score the employee on fixed principles and competencies, check the next level's requirements, and formally decide on the promotion — which adjusts level and salary automatically when approved.",
      },
    ],
  },
];
