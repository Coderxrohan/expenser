import "./globals.css";
import "@/styles/style.css";
import "@/styles/dashboard.css";
import "@/styles/responsive.css";
import { AppProvider } from "@/context/AppContext";

export const metadata = {
  title: "Ledger — Expense Manager",
  description: "A quiet place to keep the books.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
