const TOKEN_UNIT: u64 = 1_000_000;
const INITIAL_POOL: u64 = 1_000 * TOKEN_UNIT;
const INITIAL_BALANCE: u64 = 100 * TOKEN_UNIT;
const BASIS_POINTS: u128 = 10_000;
const FEE: u128 = 30;
const SLIPPAGE: u128 = 50;

pub const FEE_LABEL: &str = "0.30%";
pub const SLIPPAGE_LABEL: &str = "0.50%";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Token {
    A = 0,
    B = 1,
}

impl Token {
    pub const fn other(self) -> Self {
        match self {
            Self::A => Self::B,
            Self::B => Self::A,
        }
    }

    pub const fn label(self) -> &'static str {
        match self {
            Self::A => "Token A",
            Self::B => "Token B",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Quote {
    pub token: Token,
    pub sent: u64,
    pub received: u64,
    pub fee: u64,
    pub minimum: u64,
}

pub struct Practice {
    wallet: [u64; 2],
    pool: [u64; 2],
}

impl Default for Practice {
    fn default() -> Self {
        Self {
            wallet: [INITIAL_BALANCE; 2],
            pool: [INITIAL_POOL; 2],
        }
    }
}

impl Practice {
    pub fn balance(&self, token: Token) -> u64 {
        self.wallet[token as usize]
    }

    pub fn reserve(&self, token: Token) -> u64 {
        self.pool[token as usize]
    }

    pub fn quote(&self, token: Token, input: &str) -> Result<Quote, &'static str> {
        let sent = parse_amount(input).ok_or("0보다 큰 수량을 소수점 6자리까지 입력하세요.")?;
        if sent > self.balance(token) {
            return Err("내가 가진 토큰보다 많이 보낼 수 없어요.");
        }
        let gross = u128::from(sent);
        let fee = (gross * FEE).div_ceil(BASIS_POINTS);
        let net = gross - fee;
        let reserve_in = u128::from(self.reserve(token));
        let reserve_out = u128::from(self.reserve(token.other()));
        let received = reserve_out * net / (reserve_in + net);
        if received == 0 {
            return Err("받을 수량이 너무 적어요. 보내는 수량을 늘려 보세요.");
        }

        Ok(Quote {
            token,
            sent,
            received: received as u64,
            fee: fee as u64,
            minimum: (received * (BASIS_POINTS - SLIPPAGE)).div_ceil(BASIS_POINTS) as u64,
        })
    }

    pub fn execute(&mut self, reviewed: Quote) -> Result<Quote, &'static str> {
        let current = self.quote(reviewed.token, &format_amount(reviewed.sent))?;
        if current.received < reviewed.minimum {
            return Err("교환 조건이 바뀌었어요. 최신 예상 수령량을 확인하세요.");
        }

        let from = current.token as usize;
        let to = current.token.other() as usize;
        self.wallet[from] -= current.sent;
        self.pool[from] += current.sent;
        self.wallet[to] += current.received;
        self.pool[to] -= current.received;
        Ok(current)
    }
}

fn parse_amount(text: &str) -> Option<u64> {
    let text = text.trim();
    let (whole, fraction) = text.split_once('.').unwrap_or((text, ""));
    if (whole.is_empty() && fraction.is_empty())
        || (text.ends_with('.'))
        || fraction.len() > 6
        || !whole
            .bytes()
            .chain(fraction.bytes())
            .all(|byte| byte.is_ascii_digit())
    {
        return None;
    }
    let whole = if whole.is_empty() {
        0
    } else {
        whole.parse::<u64>().ok()?
    };
    let fraction = fraction.parse::<u64>().unwrap_or(0) * 10u64.pow(6 - fraction.len() as u32);
    let amount = whole.checked_mul(TOKEN_UNIT)?.checked_add(fraction)?;
    (amount > 0).then_some(amount)
}

pub fn format_amount(amount: u64) -> String {
    let whole = amount / TOKEN_UNIT;
    let fraction = amount % TOKEN_UNIT;
    if fraction == 0 {
        return whole.to_string();
    }
    let exact = format!("{whole}.{fraction:06}");
    exact.trim_end_matches('0').to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_the_web_apps_initial_quote() {
        let quote = Practice::default().quote(Token::A, "1").unwrap();
        assert_eq!(quote.received, 996_006);
        assert_eq!(quote.fee, 3_000);
        assert_eq!(quote.minimum, 991_026);
        assert_eq!(format_amount(quote.received), "0.996006");
    }

    #[test]
    fn validates_precision_balance_and_tiny_trades() {
        assert_eq!(parse_amount(".1"), Some(100_000));
        assert_eq!(parse_amount("1.234567"), Some(1_234_567));
        for input in [
            "",
            ".",
            "1.",
            "0",
            "1.2345678",
            "-1",
            "1e2",
            "1..2",
            "18446744073709.551616",
        ] {
            assert_eq!(parse_amount(input), None, "{input}");
        }
        let practice = Practice::default();
        assert!(practice.quote(Token::A, "100.000001").is_err());
        assert!(practice.quote(Token::A, ".000002").is_err());
        assert_eq!(practice.quote(Token::A, ".000003").unwrap().received, 1);
    }

    #[test]
    fn changes_both_balances_and_pool_in_either_direction() {
        let mut practice = Practice::default();
        let quote = practice.quote(Token::A, "1").unwrap();
        practice.execute(quote).unwrap();
        assert_eq!(practice.balance(Token::A), 99_000_000);
        assert_eq!(practice.balance(Token::B), 100_996_006);
        assert_eq!(practice.reserve(Token::A), 1_001_000_000);
        assert_eq!(practice.reserve(Token::B), 999_003_994);
        let quote = practice.quote(Token::B, "1").unwrap();
        practice.execute(quote).unwrap();
        assert_eq!(practice.balance(Token::B), 99_996_006);
        for token in [Token::A, Token::B] {
            assert_eq!(
                practice.balance(token) + practice.reserve(token),
                1_100_000_000
            );
        }
    }

    #[test]
    fn rejects_stale_quote_without_moving_tokens() {
        let mut practice = Practice::default();
        let reviewed = practice.quote(Token::A, "1").unwrap();
        practice
            .execute(practice.quote(Token::A, "80").unwrap())
            .unwrap();
        let wallet = practice.wallet;
        let pool = practice.pool;
        assert!(practice.execute(reviewed).is_err());
        assert_eq!(practice.wallet, wallet);
        assert_eq!(practice.pool, pool);
    }
}
