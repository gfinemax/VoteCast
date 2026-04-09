import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ProjectorProvider } from "@/components/admin/ProjectorContext";

export const metadata = {
  title: "VoteCast - 총회 관리 시스템",
  description: "재개발 조합 총회 투표 관리 시스템",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <StoreProvider>
          <ProjectorProvider>
            {children}
          </ProjectorProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
