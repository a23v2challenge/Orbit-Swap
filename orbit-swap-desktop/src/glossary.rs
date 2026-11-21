#[derive(Clone, Copy)]
pub struct Term {
    pub label: &'static str,
    pub title: &'static str,
    pub meaning: &'static str,
    pub example: &'static str,
    pub source: &'static str,
}

const JUPITER: &str = "https://developers.jup.ag/docs/guides/how-to-build-a-custom-swap-with-metis";
const UNISWAP: &str = "https://developers.uniswap.org/docs/get-started/concepts/how-uniswap-works";
const PAYMENTS: &str = "https://solana.com/docs/payments/how-payments-work";
const EXPLORER: &str = "https://solana.com/docs/payments/interacting-with-solana";

pub const TOKEN: Term = Term {
    label: "토큰",
    title: "토큰",
    meaning: "블록체인에서 주고받을 수 있는 디지털 자산이에요. 이 앱에서는 가상의 Token A와 Token B를 사용해요.",
    example: "USDC라는 토큰은 온라인 결제와 송금에 쓰여요. 가게는 받은 금액을 거래 기록에서 확인할 수 있어요.",
    source: PAYMENTS,
};
pub const SWAP: Term = Term {
    label: "스왑",
    title: "스왑 · 토큰 교환",
    meaning: "한 종류의 토큰을 보내고 다른 종류의 토큰을 받는 일이에요. 이 앱에서는 Token A를 B로 바꾸거나 그 반대로 바꿀 수 있어요.",
    example: "Jupiter 같은 서비스에서는 Solana에서 쓰는 SOL을 USDC로 바꿀 수 있어요.",
    source: JUPITER,
};
pub const ESTIMATE: Term = Term {
    label: "예상 수령량",
    title: "예상 수령량",
    meaning: "지금 조건대로 교환하면 받을 것으로 예상되는 토큰 수량이에요. 보내는 수량이나 풀에 남은 수량이 달라지면 이 값도 바뀌어요.",
    example: "Jupiter는 교환을 승인하기 전에 수수료를 반영한 예상 수령량을 보여줘요.",
    source: JUPITER,
};
pub const FEE: Term = Term {
    label: "스왑 수수료",
    title: "스왑 수수료",
    meaning: "두 토큰을 바꿀 때 드는 교환 비용이에요. 이 앱은 Token A를 1개 보낼 때 0.003개를 수수료로 계산해요.",
    example: "Uniswap에서는 교환 수수료 일부가 풀에 토큰을 맡긴 사람에게 보상으로 돌아갈 수 있어요.",
    source: UNISWAP,
};
pub const SLIPPAGE: Term = Term {
    label: "슬리피지 한도",
    title: "슬리피지 한도",
    meaning: "예상보다 적게 받아도 되는 범위예요. 100개를 예상하고 한도가 0.50%라면, 99.5개보다 적게 받을 거래는 실패해요.",
    example: "Jupiter 같은 서비스는 승인을 기다리는 사이에 가격이 움직여 너무 적게 받는 일을 막는 데 이 한도를 써요.",
    source: JUPITER,
};
pub const MINIMUM: Term = Term {
    label: "최소 수령량",
    title: "최소 수령량",
    meaning: "교환이 성공하려면 최소한 이만큼 받아야 해요. 예상 수령량과 허용한 슬리피지로 계산해요.",
    example: "Jupiter가 최소 수령량을 99.5개로 계산했다면 99개만 받을 조건에서는 교환이 성립하지 않아요.",
    source: JUPITER,
};
pub const POOL: Term = Term {
    label: "교환용 풀",
    title: "교환용 풀 · 유동성 풀",
    meaning: "교환에 쓸 토큰을 담아 둔 공동 금고 같은 곳이에요. 내가 A를 보내고 B를 받으면 풀 안의 A는 늘고 B는 줄어요.",
    example: "Orca에서는 이용자가 풀에 토큰을 맡기고, 다른 이용자가 그 풀에서 토큰을 교환해요.",
    source: "https://docs.orca.so/",
};
pub const CONSTANT_PRODUCT: Term = Term {
    label: "상수곱 방식",
    title: "상수곱 방식",
    meaning: "풀에 남은 두 토큰의 수량을 곱한 값을 기준으로 교환 수량을 정하는 방식이에요. B를 한꺼번에 많이 가져갈수록 B 한 개당 더 많은 A가 필요해요.",
    example: "Uniswap v2는 풀에 남은 수량을 이용해 이 방식으로 교환 가격을 계산해요.",
    source: UNISWAP,
};
pub const BLOCKCHAIN: Term = Term {
    label: "블록체인",
    title: "블록체인",
    meaning: "여러 컴퓨터가 함께 보관하고 확인하는 거래 장부예요. 공개 블록체인에서는 누구나 기록된 거래를 찾아볼 수 있어요.",
    example: "Solana에서 토큰 결제를 받은 가게는 거래 조회 사이트에서 입금 여부와 금액을 확인할 수 있어요.",
    source: EXPLORER,
};
pub const SOLANA: Term = Term {
    label: "Solana",
    title: "Solana · 솔라나",
    meaning: "거래 기록을 남기고 앱에 정해진 규칙을 실행할 수 있는 블록체인 네트워크예요.",
    example: "온라인 가게는 Solana Pay로 QR 코드나 결제 링크를 만들어 토큰 결제를 받을 수 있어요.",
    source: "https://solana.com/docs/tools/solana-pay",
};
pub const DEFI: Term = Term {
    label: "DeFi",
    title: "DeFi · 탈중앙화 금융",
    meaning: "블록체인에서 실행되는 코드로 교환 같은 금융 서비스를 이용하는 방식이에요. 사용자가 자신의 지갑으로 거래를 승인해요.",
    example: "Orca에서는 지갑을 연결해 풀에 모인 토큰으로 교환할 수 있어요.",
    source: "https://docs.orca.so/",
};
pub const PHANTOM: Term = Term {
    label: "Phantom 지갑",
    title: "Phantom 지갑",
    meaning: "내 토큰 잔액을 확인하고, 토큰을 보내거나 블록체인 앱의 거래를 승인하는 디지털 지갑이에요.",
    example: "실제 교환 앱에 지갑을 연결한 뒤, Phantom에 표시된 거래 내용을 읽고 승인하거나 취소할 수 있어요.",
    source: "https://docs.phantom.com/solana/integrating-phantom",
};
pub const DEVNET: Term = Term {
    label: "Devnet",
    title: "Devnet · 개발용 네트워크",
    meaning: "Solana에서 가치가 없는 테스트 토큰으로 거래를 시험하는 환경이에요. Orbit Swap 웹 버전은 이 환경을 사용해요.",
    example: "송금 앱을 만드는 팀은 출시 전에 Devnet으로 결제와 거래 조회가 잘 되는지 확인해요.",
    source: "https://solana.com/docs/references/clusters",
};
pub const SIGNATURE: Term = Term {
    label: "트랜잭션 서명",
    title: "트랜잭션 서명 · 거래 조회 번호",
    meaning: "지갑이 거래를 승인했다는 디지털 표시예요. Solana에서는 거래에 붙은 첫 번째 서명을 조회 번호로도 사용해요.",
    example: "토큰이 도착했는지 궁금할 때 거래 서명을 검색하면 실제 수량과 성공 여부를 확인할 수 있어요.",
    source: "https://solana.com/learn/sending-and-receiving-sol",
};
pub const SOLANA_EXPLORER: Term = Term {
    label: "Solana Explorer",
    title: "Solana Explorer · 거래 조회 사이트",
    meaning: "Solana에 공개된 거래 기록을 찾아보는 웹사이트예요. Devnet 거래는 Devnet을 선택해 찾을 수 있어요.",
    example: "결제를 받은 가게는 거래 번호로 성공 여부를 확인하고, 개발자는 실패한 거래의 상세 내용을 찾아봐요.",
    source: EXPLORER,
};
