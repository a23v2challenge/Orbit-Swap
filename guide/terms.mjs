const payments = "https://solana.com/docs/payments/how-payments-work";
const swapGuide = "https://developers.jup.ag/docs/guides/how-to-build-a-custom-swap-with-metis";
const uniswap = "https://developers.uniswap.org/docs/get-started/concepts/how-uniswap-works";
const phantom = "https://help.phantom.com/articles/how-to-connect-to-dapps-using-phantom-wallet-29995498642195";
const explorer = "https://solana.com/docs/payments/interacting-with-solana";

export const terms = {
  blockchain: {
    title: "블록체인",
    meaning: "여러 컴퓨터가 함께 보관하고 확인하는 거래 장부예요. 공개 블록체인에서는 누구나 기록된 거래를 찾아볼 수 있어요.",
    example: "USDC로 결제를 받은 가게는 연동된 결제 서비스나 Solana Explorer에서 입금 금액과 처리 상태를 확인할 수 있어요.",
    source: explorer,
  },
  solana: {
    title: "Solana (솔라나)",
    meaning: "거래 기록을 남기고 앱의 규칙을 실행할 수 있는 블록체인 네트워크예요. Orbit Swap은 Solana의 연습 환경에서 돌아가요.",
    example: "온라인 상점은 Solana Pay로 결제 링크나 QR 코드를 만들어 USDC 결제를 받을 수 있어요.",
    source: "https://solana.com/docs/tools/solana-pay",
  },
  defi: {
    title: "DeFi (탈중앙화 금융)",
    meaning: "블록체인에서 실행되는 프로그램으로 토큰 교환 같은 금융 서비스를 이용하는 방식이에요. 사용자는 자신의 지갑으로 거래를 승인해요.",
    example: "Solana의 Orca에서는 지갑을 연결하고, 교환용 토큰이 모여 있는 풀을 통해 한 토큰을 다른 토큰으로 바꿀 수 있어요.",
    source: "https://docs.orca.so/",
  },
  phantom: {
    title: "Phantom 지갑",
    meaning: "토큰 잔액을 보고, 토큰을 보내고, 블록체인 앱의 거래를 승인할 수 있는 디지털 지갑 앱이에요.",
    example: "Solana에서 토큰을 교환할 때 앱에 Phantom을 연결한 뒤, 지갑에 표시되는 거래 내용을 보고 승인할 수 있어요.",
    source: phantom,
  },
  devnet: {
    title: "Devnet (개발용 네트워크)",
    meaning: "Solana에서 앱과 거래를 연습하는 환경이에요. 여기에서 쓰는 SOL과 연습용 토큰은 실제 결제 가치가 없어요.",
    example: "결제 앱을 만드는 팀은 서비스를 열기 전에 Devnet에서 송금, 입금 확인, 실패 안내가 잘 작동하는지 시험해요.",
    source: "https://solana.com/docs/references/clusters",
  },
  estimate: {
    title: "예상 수령량",
    meaning: "지금 보이는 조건으로 교환한다면 받을 것으로 예상되는 토큰 수량이에요. 실제로 처리될 때까지 교환 조건은 바뀔 수 있어요.",
    example: "Jupiter는 거래를 승인하기 전에 수수료를 반영한 예상 수령량을 보여줘서 교환 조건을 비교할 수 있게 해요.",
    source: swapGuide,
  },
  swapFee: {
    title: "스왑 수수료",
    meaning: "토큰을 바꿀 때 들어가는 교환 비용이에요. Orbit Swap은 보내는 토큰의 0.30%를 수수료로 계산해요.",
    example: "Uniswap 같은 서비스에서는 풀마다 교환 수수료가 다를 수 있으며, 수수료는 풀에 토큰을 맡긴 사람에게 보상으로 돌아갈 수 있어요.",
    source: uniswap,
  },
  slippage: {
    title: "슬리피지 한도",
    meaning: "견적을 본 뒤 실제 거래가 처리될 때까지 수령량이 얼마나 줄어들어도 괜찮은지 정하는 기준이에요. 예를 들어 100개를 예상하고 한도가 0.50%라면, 99.5개보다 적게 받을 거래는 실패해요.",
    example: "Jupiter 같은 교환 서비스는 승인하는 사이에 가격이 움직여 예상보다 너무 적게 받는 일을 막는 데 이 한도를 써요.",
    source: swapGuide,
  },
  minimum: {
    title: "최소 수령량",
    meaning: "거래가 성공하려면 받아야 하는 최소 토큰 수량이에요. 예상 수령량에 슬리피지 한도를 적용해 계산해요.",
    example: "Jupiter가 최소 수령량을 99.5개로 계산했다면, 실제로 99개만 받을 상황에서는 교환이 실행되지 않아요.",
    source: swapGuide,
  },
  pool: {
    title: "데모 풀 (연습용 유동성 풀)",
    meaning: "교환에 쓸 두 종류의 토큰을 미리 담아 둔 공동 금고 같은 곳이에요. Orbit Swap에서 A를 넣고 B를 받으면 풀 안의 A는 늘고 B는 줄어요.",
    example: "Orca에서는 사람들이 풀에 토큰을 넣어 두면 다른 사람이 그 풀에서 토큰을 교환할 수 있어요.",
    source: "https://docs.orca.so/",
  },
  sol: {
    title: "SOL (솔라나 기본 코인)",
    meaning: "Solana에서 쓰는 기본 코인이에요. 여기서는 테스트 SOL을 받아 풀을 만들거나 거래를 기록할 때 드는 네트워크 수수료를 내요.",
    example: "실제 Solana 네트워크에서 USDC를 보낼 때도, 거래 처리 수수료는 SOL로 지급돼요.",
    source: payments,
  },
  rust: {
    title: "Rust (러스트)",
    meaning: "프로그램을 만드는 데 쓰는 언어예요. Orbit Swap에서는 교환량을 계산하고 토큰을 옮기는 규칙을 Rust로 작성했어요.",
    example: "Solana의 앱 개발자는 Rust로 거래 조건에 맞으면 토큰을 보내는 프로그램을 만들어요.",
    source: "https://solana.com/docs/programs/rust",
  },
  program: {
    title: "Solana 프로그램 (스마트 계약)",
    meaning: "Solana 네트워크에서 정해진 규칙대로 실행되는 코드예요. Orbit Swap의 프로그램은 최소 수령량을 확인한 뒤 조건이 맞으면 토큰을 옮겨요.",
    example: "Solana의 토큰 프로그램은 누가 토큰을 보낼 권한이 있는지 확인하고, 보내는 쪽과 받는 쪽의 잔액을 바꿔요.",
    source: payments,
  },
  constantProduct: {
    title: "상수곱 방식",
    meaning: "풀에 남은 두 토큰의 수량을 곱한 값을 기준으로 받을 수량을 계산하는 방식이에요. 같은 풀에서 B를 한꺼번에 더 많이 가져갈수록 B 한 개당 더 많은 A를 내게 돼요.",
    example: "Uniswap v2는 풀에 남은 두 토큰의 수량을 이용하는 이 방식으로 교환 가격을 정해요.",
    source: uniswap,
  },
  networkFee: {
    title: "네트워크 수수료",
    meaning: "Solana가 거래를 처리할 때 내는 비용이에요. Orbit Swap 화면의 스왑 수수료와 별도로 SOL로 내요.",
    example: "친구에게 SOL을 보내는 거래에도 네트워크 수수료가 들고, 처리된 거래의 상세 내역에서 비용을 확인할 수 있어요.",
    source: "https://solana.com/learn/sending-and-receiving-sol",
  },
  approval: {
    title: "지갑 승인 (거래 서명)",
    meaning: "지갑에서 거래 내용을 확인한 뒤, 내 지갑이 동의했다는 디지털 서명을 남기는 과정이에요.",
    example: "토큰을 보낼 때 Phantom에서 받을 주소와 수량을 확인하고 승인하면, Solana가 서명을 확인한 뒤 거래를 처리해요.",
    source: phantom,
  },
  signature: {
    title: "트랜잭션 서명 (거래 조회 번호)",
    meaning: "트랜잭션은 블록체인에 처리를 요청하는 거래예요. Solana는 거래에 붙은 첫 번째 디지털 서명을 그 거래를 찾아보는 고유 번호로도 사용해요.",
    example: "송금이 도착했는지 궁금할 때 이 번호를 Solana Explorer에 입력하면 성공 여부와 보낸 수량을 확인할 수 있어요.",
    source: "https://solana.com/learn/sending-and-receiving-sol",
  },
  explorer: {
    title: "Solana Explorer (거래 조회 사이트)",
    meaning: "Solana에 공개된 거래와 지갑 주소의 활동을 검색하는 웹사이트예요. 연습 거래는 Devnet을 선택해서 찾아봐요.",
    example: "온라인 가게나 결제 앱 운영자는 결제가 성공했는지 확인하거나 실패한 거래의 상세 기록을 찾아볼 때 사용해요.",
    source: explorer,
  },
};
