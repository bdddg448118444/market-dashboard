export const metadata = {
  title: "Market Conditions Dashboard",
  description: "Dover × Mikey × Marc — Live Market Intelligence",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#060810" }}>
        {children}
      </body>
    </html>
  );
}
