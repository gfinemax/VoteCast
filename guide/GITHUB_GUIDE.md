# GitHub 업로드 가이드

작업하신 **VoteCast** 프로젝트를 깃허브(GitHub)에 업로드하는 단계별 방법입니다.

## 1. 로컬 저장소 준비 (터미널)

먼저 현재 작성된 코드를 로컬 Git 저장소에 저장해야 합니다.
VS Code의 터미널(`Ctrl + ` `)을 열고 아래 명령어를 순서대로 입력하세요.

```bash
# 1. 파일 전체 스테이징
git add .

# 2. 커밋 (변경사항 저장)
git commit -m "Initial commit: VoteCast with Next.js 14"
```
*(이미 `create-next-app`으로 초기화되어 있으므로 `git init`은 필요 없을 수 있습니다. 만약 오류가 난다면 `git init`을 먼저 하세요.)*

## 2. 깃허브 저장소 생성 (웹사이트)

1. [GitHub.com](https://github.com)에 로그인합니다.
2. 우측 상단의 **+** 아이콘을 누르고 **New repository**를 클릭합니다.
3. **Repository name**에 `VoteCast` (또는 원하는 이름)를 입력합니다.
4. **Public** (공개) 또는 **Private** (비공개)를 선택합니다.
5. *Initialize this repository with...* 항목들은 **모두 체크 해제** 상태로 둡니다 (이미 로컬에 코드가 있기 때문).
6. **Create repository** 버튼을 클릭합니다.

## 3. 원격 저장소 연결 및 업로드 (터미널)

저장소가 생성되면 화면에 나오는 명령어 중 **"…or push an existing repository from the command line"** 부분을 참고하거나, 아래 명령어를 복사하여 터미널에 입력합니다.

```bash
# 1. 원격 저장소 주소 등 (YOUR_ID 부분은 본인 아이디로 변경)
git remote add origin https://github.com/YOUR_GITHUB_ID/VoteCast.git

# 2. 메인 브랜치 이름 설정
git branch -M main

# 3. 깃허브로 코드 밀어넣기 (Push)
git push -u origin main
```

## 4. 확인

브라우저에서 해당 리포지토리 페이지를 새로고침하면 코드가 업로드된 것을 확인할 수 있습니다.
