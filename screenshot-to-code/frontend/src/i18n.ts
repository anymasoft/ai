import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      appName: "screenshot-to-code",
    },
    landing: {
      header: {
        navLinks: {
          pricing: "Pricing",
        },
        login: "Sign In",
        register: "Sign Up",
      },
      hero: {
        badge: "Welcome to screenshot-to-code",
        title: "screenshot-to-code",
        description: "Turn screenshots into code with AI",
        cta: {
          primary: "Get Started",
          secondary: "Learn More",
        },
        image: {
          light: "Light mode screenshot",
          dark: "Dark mode screenshot",
        },
      },
      logos: {
        title: "Powered by modern tools",
      },
      description: {
        eyebrow: "How it works",
        title: "Simple and powerful",
        subtitle: "Upload a screenshot and get clean, readable code",
        features: [
          {
            title: "AI-Powered",
            description: "Uses advanced AI to understand your designs",
          },
          {
            title: "Fast",
            description: "Get results in seconds",
          },
          {
            title: "Accurate",
            description: "High-quality code output",
          },
          {
            title: "Flexible",
            description: "Multiple framework options",
          },
        ],
        image: {
          light: "Dashboard light",
          dark: "Dashboard dark",
        },
      },
      features: {
        eyebrow: "Features",
        title: "Everything you need",
        cards: [
          {
            eyebrow: "Mobile",
            title: "Mobile Support",
            description: "Full mobile responsiveness",
            image: {
              light: "Mobile light",
              dark: "Mobile dark",
            },
          },
          {
            eyebrow: "Billing",
            title: "Billing System",
            description: "Built-in billing integration",
            image: {
              light: "Billing light",
              dark: "Billing dark",
            },
          },
          {
            eyebrow: "Auth",
            title: "Authentication",
            description: "Secure authentication system",
            image: {
              light: "Auth light",
              dark: "Auth dark",
            },
          },
          {
            title: "Notifications",
            description: "Real-time notifications",
            image: {
              light: "Notifications light",
              dark: "Notifications dark",
            },
          },
          {
            title: "Dark Mode",
            description: "Full dark mode support",
          },
          {
            eyebrow: "Team",
            title: "Team Management",
            description: "Manage your team",
          },
          {
            eyebrow: "i18n",
            title: "Internationalization",
            description: "Multi-language support",
          },
          {
            eyebrow: "More",
            title: "And More",
            description: "Many more features included",
          },
        ],
      },
      cta: {
        title: "Ready to get started?",
        description: "Start converting your designs to code today",
        buttons: {
          primary: "Get Started",
          secondary: "Learn More",
        },
      },
      faq: {
        title: "Frequently Asked Questions",
        items: [
          {
            question: "How does it work?",
            answer: "Upload a screenshot and our AI will convert it to code",
          },
          {
            question: "What frameworks are supported?",
            answer: "We support React, Vue, HTML, and more",
          },
          {
            question: "Is there a free plan?",
            answer: "Yes, we have a free plan with limited conversions",
          },
          {
            question: "How accurate is the output?",
            answer: "Our AI achieves high accuracy rates",
          },
          {
            question: "Can I edit the generated code?",
            answer: "Yes, the code is fully editable",
          },
          {
            question: "What about privacy?",
            answer: "Your designs are private and secure",
          },
        ],
      },
      footer: {
        social: {
          github: "GitHub",
          twitter: "Twitter",
          linkedin: "LinkedIn",
        },
        madeWithLove: "Made with ❤️ by",
        reactsquad: "ReactSquad",
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
