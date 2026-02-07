export const metadata = {
  title: "Market Conditions Dashboard",
  description: "Dover × Mikey × Marc — Live Market Intelligence",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#060810" }}>
        {children}
      </body>
    </html>
  );
}
