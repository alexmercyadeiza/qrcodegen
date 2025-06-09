import "./globals.css";

export const metadata = {
    title: "True QR",
    description: "No fluff, just QR codes.",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
