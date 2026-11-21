mod glossary;
mod practice;

use gpui::{
    App, Application, Bounds, Context, Div, ElementId, Entity, KeyBinding, Menu, MenuItem,
    ParentElement, Styled, Subscription, TitlebarOptions, Window, WindowBounds, WindowOptions,
    actions, div, prelude::*, px, rgb, size,
};
use gpui_component::{
    Disableable, Root, Sizable, StyledExt, Theme, ThemeMode, WindowExt,
    button::{Button, ButtonVariants},
    dialog::DialogButtonProps,
    input::{Input, InputEvent, InputState},
};

use glossary::*;
use practice::{FEE_LABEL, Practice, Quote, SLIPPAGE_LABEL, Token, format_amount};

const PAGE: u32 = 0xf3f5fa;
const WHITE: u32 = 0xffffff;
const INK: u32 = 0x14223a;
const MUTED: u32 = 0x52617a;
const BORDER: u32 = 0xe0e6f0;
const BLUE: u32 = 0x234eb4;
const BLUE_PALE: u32 = 0xf0f5ff;
const GREEN: u32 = 0x126753;
const GREEN_PALE: u32 = 0xe7f5ee;
const ERROR: u32 = 0x9c302a;

actions!(orbit_swap, [Quit]);

struct OrbitSwap {
    amount: Entity<InputState>,
    _amount_subscription: Subscription,
    practice: Practice,
    from: Token,
    latest: Option<Quote>,
    trade_error: Option<&'static str>,
}

impl OrbitSwap {
    fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let amount = cx.new(|cx| InputState::new(window, cx).default_value("1"));
        let subscription =
            cx.subscribe_in(&amount, window, |this, _, event, window, cx| match event {
                InputEvent::Change => {
                    this.trade_error = None;
                    cx.notify();
                }
                InputEvent::PressEnter { .. } => {
                    if !window.has_active_dialog(cx) {
                        this.open_review(window, cx);
                    }
                }
                _ => {}
            });
        Self {
            amount,
            _amount_subscription: subscription,
            practice: Practice::default(),
            from: Token::A,
            latest: None,
            trade_error: None,
        }
    }

    fn reset(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.practice = Practice::default();
        self.from = Token::A;
        self.latest = None;
        self.set_amount("1", window, cx);
    }

    fn set_amount(&mut self, amount: &'static str, window: &mut Window, cx: &mut Context<Self>) {
        self.amount
            .update(cx, |input, cx| input.set_value(amount, window, cx));
        self.trade_error = None;
        cx.notify();
    }

    fn quote(&self, cx: &App) -> Result<Quote, &'static str> {
        self.practice
            .quote(self.from, &self.amount.read(cx).value())
    }

    fn open_review(&self, window: &mut Window, cx: &mut Context<Self>) {
        let Ok(quote) = self.quote(cx) else {
            return;
        };
        let view = cx.weak_entity();
        window.open_dialog(cx, move |dialog, _, _| {
            let view = view.clone();
            dialog
                .title(heading("교환 내용 확인", 22.))
                .width(px(460.))
                .confirm()
                .button_props(
                    DialogButtonProps::default()
                        .ok_text("연습 교환 실행")
                        .cancel_text("돌아가기"),
                )
                .child(
                    column()
                        .gap_3()
                        .child(body_text("연습용 토큰의 수량과 교환 조건을 확인하세요."))
                        .child(value_row(
                            "보내는 수량",
                            token_amount(quote.sent, quote.token),
                        ))
                        .child(value_row(
                            term_button("review-estimate", ESTIMATE),
                            token_amount(quote.received, quote.token.other()),
                        ))
                        .child(value_row(
                            term_button("review-fee", FEE),
                            token_amount(quote.fee, quote.token),
                        ))
                        .child(value_row(
                            term_button("review-slippage", SLIPPAGE),
                            SLIPPAGE_LABEL.to_owned(),
                        ))
                        .child(value_row(
                            term_button("review-minimum", MINIMUM),
                            token_amount(quote.minimum, quote.token.other()),
                        )),
                )
                .on_ok(move |_, _, cx| {
                    let _ = view.update(cx, |app, cx| {
                        match app.practice.execute(quote) {
                            Ok(trade) => {
                                app.latest = Some(trade);
                                app.trade_error = None;
                            }
                            Err(error) => app.trade_error = Some(error),
                        }
                        cx.notify();
                    });
                    true
                })
        });
    }

    fn swap_panel(&self, cx: &mut Context<Self>) -> Div {
        let quote = self.quote(cx);
        let quoted_terms = quote.ok();
        let hint = self.trade_error.or_else(|| quote.err());
        let to = self.from.other();

        let mut presets = row().gap_2();
        for amount in ["1", "10", "50"] {
            presets = presets.child(
                Button::new(amount)
                    .small()
                    .label(format!("{amount}개"))
                    .on_click(cx.listener(move |this, _, window, cx| {
                        this.set_amount(amount, window, cx);
                    })),
            );
        }
        panel()
            .gap_4()
            .child(
                row()
                    .justify_between()
                    .gap_2()
                    .child(heading("교환해 보기", 21.))
                    .child(
                        Button::new("reverse")
                            .small()
                            .label("⇄  방향 바꾸기")
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.from = this.from.other();
                                this.trade_error = None;
                                cx.notify();
                            })),
                    ),
            )
            .child(
                column()
                    .gap_2()
                    .child(
                        row()
                            .justify_between()
                            .gap_2()
                            .child(name("보내는 수량"))
                            .child(token_tag(self.from)),
                    )
                    .child(Input::new(&self.amount).large().w_full())
                    .child(presets),
            )
            .child(
                column()
                    .gap_1()
                    .p_4()
                    .rounded_lg()
                    .bg(rgb(BLUE_PALE))
                    .child(
                        row()
                            .justify_between()
                            .gap_2()
                            .child(term_button("estimate", ESTIMATE))
                            .child(token_tag(to)),
                    )
                    .child(heading(
                        quoted_terms.map_or_else(|| "—".to_owned(), |q| format_amount(q.received)),
                        30.,
                    )),
            )
            .child(
                column()
                    .gap_1()
                    .child(value_row(
                        term_button("fee", FEE),
                        quoted_terms.map_or_else(
                            || FEE_LABEL.to_owned(),
                            |q| format!("{FEE_LABEL} · {}", token_amount(q.fee, self.from)),
                        ),
                    ))
                    .child(value_row(
                        term_button("slippage", SLIPPAGE),
                        SLIPPAGE_LABEL.to_owned(),
                    ))
                    .child(value_row(
                        term_button("minimum", MINIMUM),
                        quoted_terms
                            .map_or_else(|| "—".to_owned(), |q| token_amount(q.minimum, to)),
                    )),
            )
            .when_some(hint, |panel, hint| {
                panel.child(body_text(hint).text_color(rgb(ERROR)))
            })
            .child(
                Button::new("review")
                    .primary()
                    .large()
                    .w_full()
                    .label("교환 내용 확인")
                    .disabled(quoted_terms.is_none())
                    .on_click(cx.listener(|this, _, window, cx| this.open_review(window, cx))),
            )
    }

    fn balances(&self) -> Div {
        panel()
            .gap_3()
            .child(heading("내 잔액과 풀", 20.))
            .child(
                row()
                    .gap_2()
                    .child(name("종류").flex_1())
                    .child(name("내 잔액").flex_1().text_right())
                    .child(
                        div()
                            .flex_1()
                            .flex()
                            .justify_end()
                            .child(term_button("pool", POOL)),
                    ),
            )
            .children([Token::A, Token::B].map(|token| {
                row()
                    .gap_2()
                    .border_t_1()
                    .border_color(rgb(BORDER))
                    .pt_3()
                    .child(div().flex_1().child(token_tag(token)))
                    .child(
                        number(format_amount(self.practice.balance(token)))
                            .flex_1()
                            .text_right(),
                    )
                    .child(
                        number(format_amount(self.practice.reserve(token)))
                            .flex_1()
                            .text_right(),
                    )
            }))
            .child(
                row()
                    .gap_2()
                    .flex_wrap()
                    .child(body_text("교환 수량을 정하는"))
                    .child(term_button("formula", CONSTANT_PRODUCT)),
            )
    }

    fn latest_trade(&self) -> Div {
        panel()
            .gap_2()
            .child(heading("최근 교환", 20.))
            .when_some(self.latest, |panel, trade| {
                panel.child(
                    column()
                        .gap_2()
                        .rounded_lg()
                        .p_3()
                        .bg(rgb(GREEN_PALE))
                        .child(name("연습 교환 완료").text_color(rgb(GREEN)))
                        .child(number(format!(
                            "{}  →  {}",
                            token_amount(trade.sent, trade.token),
                            token_amount(trade.received, trade.token.other()),
                        )))
                        .child(body_text("내 잔액과 풀 수량에 반영했어요.")),
                )
            })
            .when(self.latest.is_none(), |panel| {
                panel.child(body_text(
                    "교환을 실행하면 보낸 수량과 받은 수량을 확인할 수 있어요.",
                ))
            })
    }
}

impl Render for OrbitSwap {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let dialog = Root::render_dialog_layer(window, cx);

        div()
            .size_full()
            .relative()
            .bg(rgb(PAGE))
            .text_color(rgb(INK))
            .child(
                div()
                    .id("practice")
                    .size_full()
                    .overflow_y_scroll()
                    .child(
                        column()
                            .mx_auto()
                            .max_w(px(1050.))
                            .p_6()
                            .gap_5()
                            .child(
                                column()
                                    .gap_2()
                                    .child(
                                        row().justify_between().gap_3()
                                            .child(heading("토큰 교환 연습", 34.))
                                            .child(
                                                row().gap_3()
                                                    .child(
                                                        row().gap_2()
                                                            .child(div().size(px(8.)).rounded_full().bg(rgb(GREEN)))
                                                            .child(name("연습 모드 · 가상 토큰")),
                                                    )
                                                    .child(
                                                        Button::new("reset")
                                                            .small()
                                                            .label("처음부터")
                                                            .on_click(cx.listener(|this, _, window, cx| this.reset(window, cx))),
                                                    ),
                                            ),
                                    )
                                    .child(body_text("Token A를 Token B로 바꿔 보고, 잔액이 어떻게 달라지는지 확인하세요."))
                                    .child(body_text("파란 밑줄을 누르면 쉬운 뜻과 실제 사용 사례를 볼 수 있어요.")),
                            )
                            .child(
                                div()
                                    .flex()
                                    .gap_4()
                                    .items_start()
                                    .child(div().flex_1().min_w_0().child(self.swap_panel(cx)))
                                    .child(
                                        column()
                                            .w(gpui::relative(0.45))
                                            .min_w_0()
                                            .gap_4()
                                            .child(self.balances())
                                            .child(self.latest_trade()),
                                    ),
                            )
                            .child(vocabulary()),
                    ),
            )
            .children(dialog)
    }
}

fn vocabulary() -> Div {
    let terms = [
        TOKEN,
        SWAP,
        BLOCKCHAIN,
        SOLANA,
        DEFI,
        PHANTOM,
        DEVNET,
        SIGNATURE,
        SOLANA_EXPLORER,
    ];
    panel()
        .gap_2()
        .child(heading("처음이라면 알아둘 용어", 18.))
        .child(
            row()
                .flex_wrap()
                .gap_x_4()
                .gap_y_1()
                .children(terms.map(|term| term_button(term.label, term))),
        )
}

fn term_button(id: impl Into<ElementId>, term: Term) -> Button {
    Button::new(id)
        .small()
        .link()
        .underline()
        .text_color(rgb(BLUE))
        .label(term.label)
        .on_click(move |_, window, cx| {
            window.open_dialog(cx, move |dialog, _, _| {
                dialog
                    .title(heading(term.title, 23.))
                    .width(px(490.))
                    .close_button(false)
                    .child(
                        column()
                            .gap_4()
                            .child(
                                column()
                                    .gap_2()
                                    .child(name("쉬운 뜻"))
                                    .child(body_text(term.meaning)),
                            )
                            .child(
                                column()
                                    .gap_2()
                                    .p_4()
                                    .rounded_lg()
                                    .bg(rgb(BLUE_PALE))
                                    .child(name("실제로 쓰이는 곳").text_color(rgb(BLUE)))
                                    .child(body_text(term.example)),
                            ),
                    )
                    .footer(move |_, _, _, _| {
                        vec![
                            Button::new("source")
                                .link()
                                .label("공식 문서 열기 ↗")
                                .on_click(move |_, _, cx| cx.open_url(term.source)),
                            Button::new("close-term")
                                .label("닫기")
                                .on_click(|_, window, cx| window.close_dialog(cx)),
                        ]
                    })
            });
        })
}

fn row() -> Div {
    div().flex().items_center()
}

fn column() -> Div {
    div().flex().flex_col()
}

fn panel() -> Div {
    column()
        .p_4()
        .rounded_xl()
        .border_1()
        .border_color(rgb(BORDER))
        .bg(rgb(WHITE))
}

fn heading(text: impl Into<gpui::SharedString>, size: f32) -> Div {
    div()
        .text_size(px(size))
        .font_semibold()
        .text_color(rgb(INK))
        .child(text.into())
}

fn number(text: String) -> Div {
    div()
        .text_sm()
        .font_semibold()
        .text_color(rgb(INK))
        .child(text)
}

fn name(text: &'static str) -> Div {
    div()
        .text_sm()
        .font_semibold()
        .text_color(rgb(MUTED))
        .child(text)
}

fn body_text(text: &'static str) -> Div {
    div()
        .text_sm()
        .line_height(px(22.))
        .text_color(rgb(MUTED))
        .child(text)
}

fn value_row(label: impl IntoElement, value: String) -> Div {
    row()
        .justify_between()
        .gap_2()
        .min_h(px(24.))
        .child(label)
        .child(number(value))
}

fn token_amount(amount: u64, token: Token) -> String {
    format!("{} {}", format_amount(amount), token.label())
}

fn token_tag(token: Token) -> Div {
    let (ink, fill) = match token {
        Token::A => (BLUE, BLUE_PALE),
        Token::B => (GREEN, GREEN_PALE),
    };
    div()
        .px_2()
        .py_1()
        .rounded_md()
        .bg(rgb(fill))
        .text_color(rgb(ink))
        .text_sm()
        .font_semibold()
        .child(token.label())
}

fn main() {
    Application::new().run(|cx: &mut App| {
        gpui_component::init(cx);
        Theme::change(ThemeMode::Light, None, cx);
        let theme = Theme::global_mut(cx);
        theme.font_family = "Apple SD Gothic Neo".into();
        theme.font_size = px(16.);
        theme.primary = rgb(BLUE).into();
        theme.primary_hover = rgb(0x1c439e).into();
        theme.primary_active = rgb(0x153582).into();
        theme.link = rgb(BLUE).into();

        cx.bind_keys([KeyBinding::new("cmd-q", Quit, None)]);
        cx.on_action(|_: &Quit, cx| cx.quit());
        cx.set_menus(vec![Menu {
            name: "Orbit Swap".into(),
            items: vec![MenuItem::action("Orbit Swap 종료", Quit)],
        }]);
        cx.on_window_closed(|cx| {
            if cx.windows().is_empty() {
                cx.quit();
            }
        })
        .detach();

        let bounds = Bounds::centered(None, size(px(960.), px(756.)), cx);
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                titlebar: Some(TitlebarOptions {
                    title: Some("Orbit Swap".into()),
                    appears_transparent: false,
                    traffic_light_position: None,
                }),
                window_min_size: Some(size(px(745.), px(520.))),
                ..Default::default()
            },
            |window, cx| {
                let view = cx.new(|cx| OrbitSwap::new(window, cx));
                cx.new(|cx| Root::new(view, window, cx))
            },
        )
        .expect("Orbit Swap 창을 열지 못했습니다");
        cx.activate(true);
    });
}
