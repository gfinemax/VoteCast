# RHA VoteCast

**Regional Housing Association VoteCast**

RHA VoteCast는 지역주택조합 총회를 위해 설계된 **실시간 투표 집계 및 대형 스크린 송출 시스템**입니다. 조합원 입장(Check-in)부터 성원 보고, 안건 설명, 투표 결과 발표까지 총회의 모든 과정을 투명하고 전문적으로 지원합니다.

---

## 🚀 핵심 기능 (Key Features)

### 1. 스마트 입장 관리 (Check-in Station)
*   **실시간 성원 집계:** 조합원의 입장(직접/대리/서면)을 실시간으로 입력하고 집계합니다.
*   **다중 총회 지원:** 여러 총회(정기/임시 등)를 폴더로 구분하여 각각 독립된 출석부를 관리할 수 있습니다.
*   **모바일 최적화:** 입구 안내 요원이 태블릿이나 스마트폰으로도 간편하게 입장 처리를 할 수 있습니다.

### 2. 통합 관제 시스템 (Total Control Admin)
*   **트리플 모니터 UI:** 관리자는 한 화면에서 **[결과 화면]**, **[발표 자료(PPT)]**, **[성원 현황]** 3개의 스크린을 동시에 보며 제어합니다.
*   **원클릭 송출 제어:** 각 화면 하단의 버튼 하나로 프로젝터 화면을 즉시 전환할 수 있습니다.
*   **의결 정보 박제 (SnapShot):** [의결 확정] 버튼을 누르면 그 순간의 성원과 투표 수가 박제되어, 이후 성원이 변동되어도 결과 데이터는 안전하게 보존됩니다.
*   **발표 제어:** 업로드된 PDF 안건 자료를 관리자 화면에서 미리 보며 원격으로 페이지를 넘길 수 있습니다.

### 3. 고품질 송출 시스템 (Pro Projector View)
*   **끊김 없는 전환:** 레이어드 렌더링 기술을 적용하여 PPT ↔ 결과 화면 전환 시 깜빡임 없이 부드럽게(Cross-fade) 전환됩니다.
*   **자동 선포문 생성:** 투표 결과에 따라 "가결/부결" 여부를 자동 판독하고, 공식 선포 문구를 자동으로 완성해줍니다.
*   **시각적 임팩트:** 결과 발표 시 도장 애니메이션(가결/부결)과 가독성 높은 디자인으로 청중에게 신뢰감을 줍니다.

### 4. 보안 및 안정성
*   **Google 인증:** 보안을 위해 허가된 계정만 관리자 패널에 접근할 수 있습니다.
*   **데이터 검증:** 입장 인원보다 투표 수가 많을 경우 경고를 표시하여 집계 오류를 방지합니다.

---

## 🛠 기술 스택 (Tech Stack)

*   **Framework:** Next.js 14, React 18
*   **Styling:** Tailwind CSS, Lucide Icons
*   **Database & Auth:** Supabase (PostgreSQL)
*   **State Management:** Zustand
*   **PDF Rendering:** React-PDF

---

## 🏁 시작하기 (Getting Started)

프로젝트를 로컬 환경에서 실행하려면 다음 단계를 따르세요:

1.  **의존성 설치:**
    ```bash
    npm install
    # or
    yarn install
    ```

2.  **환경 변수 설정:**
    `.env.local` 파일을 생성하고 Supabase 관련 키를 입력하세요.
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

3.  **개발 서버 실행:**
    ```bash
    npm run dev
    ```

4.  **접속:**
    브라우저에서 `http://localhost:3000`으로 접속하세요.

---

Designed for Professional General Meetings.
**VoteCast** 하나로 총회의 품격을 높이세요.
