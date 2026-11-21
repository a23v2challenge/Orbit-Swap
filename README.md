# Orbit Swap

토큰 교환의 수수료, 예상 수령량, 거래 기록을 배우는 프로젝트입니다.

| 버전 | 무엇을 할 수 있나요? |
| --- | --- |
| [웹 데모](https://a23v2challenge.github.io/Orbit-Swap/) | Phantom 지갑을 연결해 Solana Devnet에서 테스트 토큰을 교환합니다. 거래 전에도 밑줄 친 용어의 설명을 읽을 수 있습니다. |
| [macOS 앱](orbit-swap-desktop/) | Rust와 GPUI로 만든 앱에서 지갑 없이 가상 토큰을 교환합니다. 쉬운 용어 설명과 교환 전후 수량 변화를 확인할 수 있습니다. |

## 웹 · Solana Devnet

> **Devnet 전용 데모입니다.** 표시되는 토큰과 SOL은 테스트 자산이며 실물 가치가 없습니다. 지갑 서명은 사용자가 Phantom에서 직접 확인해야 합니다.
 
## 주요 기능

- Phantom 연결 및 Solana Devnet 확인
- 지갑별 연습 풀 생성: 풀에 토큰을 각 1,000개 넣고 지갑에 각 100개 지급
- 수수료 0.30%, 슬리피지 한도 0.50%, 최소 수령량을 포함한 스왑 견적
- 확인 완료 모달과 실제 수령량 표시
- 버튼을 눌러 Solana Explorer에서 거래 내역 열기

## Solana 프로그램

기본 Devnet 주소는 `EUBa3ZVZamiD8c18cPmfohEWnpTkeo9ZpSfB2kT7gNTs`입니다. `programs/orbit-swap/src/lib.rs`에 풀 생성, SPL 토큰 이체, 슬리피지 검사와 온체인 이벤트가 있습니다. `src/solana.mjs`는 웹 앱과 검증 스크립트가 함께 쓰는 거래 생성·조회 코드입니다.

Anchor 0.32.1과 Solana 4.2.2 도구 체인을 사용합니다. 프로그램을 다시 빌드하려면 `cargo-build-sbf` 4.6.0과 platform-tools v1.58을 사용합니다.
 
통합 검증 스크립트는 지정한 로컬 검증기 또는 공식 Devnet에 테스트 거래를 전송합니다. 로컬 검증기 사용을 권장합니다. 스크립트는 인자로 전달한 payer 키 파일을 사용하므로 **실제 자산 지갑 키를 전달하지 마세요.**
 
Devnet에서 새 프로그램을 배포할 때는 새 프로그램 키의 공개 주소로 `declare_id!`와 `Anchor.toml`을 갱신하고 다시 빌드합니다. 웹 앱의 `VITE_ORBIT_PROGRAM_ID`에도 같은 공개 주소를 지정해야 합니다. 배포 과정에는 테스트 SOL과 키 파일이 필요합니다. 키 파일, `.env` 파일, 빌드 디렉터리는 `.gitignore`에 포함되어 있습니다.
