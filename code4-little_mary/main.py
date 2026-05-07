import pygame
import random
import sys
import os
import json

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# --- 常數設定 ---
FPS = 60
WINDOW_WIDTH = 850
WINDOW_HEIGHT = 800

# 顏色定義
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (200, 200, 200)
DARK_GRAY = (80, 80, 80)
RED = (255, 50, 50)
GREEN = (50, 255, 50)
BLUE = (50, 50, 255)
YELLOW = (255, 255, 0)
ORANGE_COLOR = (255, 165, 0)
PURPLE = (128, 0, 128)
CYAN = (0, 255, 255)
GOLD = (255, 215, 0)
DARK_RED = (180, 0, 0)
LIGHT_BLUE = (173, 216, 230)
PINK = (255, 192, 203)

ITEMS = [
    {"name": "BAR", "color": RED, "odds": 50, "has_image": False},       
    {"name": "77", "color": BLUE, "odds": 40, "has_image": False},       
    {"name": "STAR", "color": YELLOW, "odds": 30, "has_image": True},   
    {"name": "WATERMELON", "color": GREEN, "odds": 20, "has_image": True}, 
    {"name": "BELL", "color": GOLD, "odds": 20, "has_image": True},     
    {"name": "MANGO", "color": GREEN, "odds": 15, "has_image": True},  
    {"name": "ORANGE", "color": ORANGE_COLOR, "odds": 10, "has_image": True}, 
    {"name": "APPLE", "color": RED, "odds": 5, "has_image": True},      
    {"name": "CHERRY", "color": RED, "odds": 2, "has_image": True},     
    {"name": "TRAIN", "color": PURPLE, "odds": 0, "has_image": False},   
    {"name": "LOSE", "color": DARK_RED, "odds": 0, "has_image": False},
    {"name": "JACKPOT", "color": CYAN, "odds": 0, "has_image": True},   
]

# 完全依照圖片順序排列 (從左上角開始順時針)
BOARD_CONFIG = [
    "ORANGE", "BELL", "CHERRY", "BAR", "JACKPOT", "CHERRY", "MANGO",
    "WATERMELON", "CHERRY", "TRAIN", "APPLE", "CHERRY",
    "ORANGE", "BELL", "CHERRY", "77", "APPLE", "CHERRY", "MANGO",
    "STAR", "CHERRY", "LOSE", "APPLE", "CHERRY"
]

# 押注按鈕依照圖片下方順序排列
BET_OPTIONS = ["APPLE", "WATERMELON", "STAR", "77", "BAR", "BELL", "MANGO", "ORANGE", "CHERRY"]

class LittleMary:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption("小瑪莉機台 (Little Mary)")
        self.clock = pygame.time.Clock()
        self.font_title = pygame.font.SysFont("microsoftjhenghei", 48, bold=True)
        self.font_large = pygame.font.SysFont("microsoftjhenghei", 36, bold=True)
        self.font_medium = pygame.font.SysFont("microsoftjhenghei", 24, bold=True)
        self.font_small = pygame.font.SysFont("microsoftjhenghei", 16, bold=True)
        self.font_tiny = pygame.font.SysFont("microsoftjhenghei", 12, bold=True)
        self.font_symbol = pygame.font.SysFont("impact", 32, bold=True)
        
        self.images = {}
        for item in ITEMS:
            if item["has_image"]:
                img_path = resource_path(f"assets/{item['name']}.png")
                try:
                    img = pygame.image.load(img_path).convert_alpha()
                    self.images[item["name"]] = pygame.transform.smoothscale(img, (55, 55))
                except Exception as e:
                    print(f"Warning: Cannot load {img_path}: {e}")
                    item["has_image"] = False

        self.credits = 0          
        self.jackpot = 500.0      
        self.win_amount = 0       
        self.bets = {opt: 0 for opt in BET_OPTIONS} 
        self.bets_modified_this_round = False
        self.last_win_was_grand_prize = False
        self.state = "IDLE"       # IDLE, SPINNING, TRAIN_SPINNING, SHOW_WIN, CONFIRM_CASH_OUT, CONFIRM_RESET, GRAND_PRIZE_START
        self.show_message = ""
        self.msg_timer = 0
        
        self.current_pos = 0      
        self.target_pos = 0       
        self.spin_timer = 0
        self.spin_delay = 50      
        self.steps_remaining = 0  
        
        self.train_lights_left = 0
        self.train_wins = []
        
        self.train_blink_count = 0
        self.is_blinking_on = True
        self.extra_spins_left = 0
        self.bounce_steps = 0
        self.bounce_delay = 50
        
        self.multi_active_pos = []
        self.bouncing_targets = []
        
        self.stats_file = "stats.json"
        self.total_accumulated_bets = 0
        self.total_accumulated_cashout = 0
        self.saved_bets_before_die = {opt: 0 for opt in BET_OPTIONS}
        self.load_stats()
        
        self._init_layout()

    def load_stats(self):
        try:
            if os.path.exists(self.stats_file):
                with open(self.stats_file, 'r') as f:
                    data = json.load(f)
                    self.total_accumulated_bets = data.get("bets", 0)
                    self.total_accumulated_cashout = data.get("cashout", 0)
        except Exception as e:
            print(f"Error loading stats: {e}")

    def save_stats(self):
        try:
            with open(self.stats_file, 'w') as f:
                json.dump({
                    "bets": self.total_accumulated_bets,
                    "cashout": self.total_accumulated_cashout
                }, f)
        except Exception as e:
            print(f"Error saving stats: {e}")

    def _init_layout(self):
        self.board_rects = []
        margin_x = 100
        margin_y = 50
        box_w = 80
        box_h = 80
        
        # 上排 (左至右)
        for i in range(7):
            self.board_rects.append(pygame.Rect(margin_x + i * box_w, margin_y, box_w, box_h))
        # 右排 (上至下)
        for i in range(1, 6):
            self.board_rects.append(pygame.Rect(margin_x + 6 * box_w, margin_y + i * box_h, box_w, box_h))
        # 下排 (右至左)
        for i in range(6, -1, -1):
            self.board_rects.append(pygame.Rect(margin_x + i * box_w, margin_y + 6 * box_h, box_w, box_h))
        # 左排 (下至上)
        for i in range(5, 0, -1):
            self.board_rects.append(pygame.Rect(margin_x, margin_y + i * box_h, box_w, box_h))

        self.info_rect = pygame.Rect(margin_x + box_w + 20, margin_y + box_w + 20, 5*box_w - 40, 5*box_h - 40)
        
        # 押分按鈕區
        self.bet_btn_rects = {}
        btn_width = 65
        btn_height = 85
        start_x = 90
        start_y = 650
        for i, opt in enumerate(BET_OPTIONS):
            x = start_x + i * (btn_width + 10)
            self.bet_btn_rects[opt] = pygame.Rect(x, start_y, btn_width, btn_height)

        # 功能按鈕區 (右側)
        self.btn_insert_coin = pygame.Rect(700, 80, 120, 50)
        self.btn_cash_out = pygame.Rect(700, 160, 120, 50)    
        self.btn_clear_bets = pygame.Rect(700, 240, 120, 50)  
        self.btn_take_score = pygame.Rect(700, 320, 120, 50)  
        self.btn_start = pygame.Rect(700, 420, 120, 100)      
        self.btn_reset_stats = pygame.Rect(WINDOW_WIDTH - 40, 10, 30, 15) 

        # 通用對話框按鈕
        self.btn_confirm = pygame.Rect(300, 420, 100, 50)
        self.btn_cancel = pygame.Rect(450, 420, 100, 50)
        self.btn_confirm_yes = self.btn_confirm
        self.btn_confirm_no = self.btn_cancel

    def set_message(self, msg, duration=2000):
        pass # 使用者要求不再顯示任何訊息

    def draw_text(self, text, font, color, surface, x, y, center=True):
        textobj = font.render(text, True, color)
        textrect = textobj.get_rect()
        if center:
            textrect.center = (x, y)
        else:
            textrect.topleft = (x, y)
        surface.blit(textobj, textrect)

    def draw_item_icon(self, item_name, rect, is_active, hide_icon=False):
        info = self.get_item_info(item_name)
        bg_color = LIGHT_BLUE if is_active else WHITE
        pygame.draw.rect(self.screen, bg_color, rect)
        
        border_color = RED if is_active else GRAY
        border_width = 5 if is_active else 2
        pygame.draw.rect(self.screen, border_color, rect, border_width)
        
        if hide_icon:
            return
            
        if info["has_image"] and item_name in self.images:
            img = self.images[item_name]
            img_rect = img.get_rect(center=rect.center)
            self.screen.blit(img, img_rect)
        else:
            if item_name == "BAR":
                pygame.draw.rect(self.screen, BLACK, (rect.centerx-30, rect.centery-20, 60, 40))
                self.draw_text("BAR", self.font_small, WHITE, self.screen, rect.centerx, rect.centery - 12)
                self.draw_text("BAR", self.font_small, WHITE, self.screen, rect.centerx, rect.centery)
                self.draw_text("BAR", self.font_small, WHITE, self.screen, rect.centerx, rect.centery + 12)
            elif item_name == "77":
                pygame.draw.circle(self.screen, RED, rect.center, 25)
                self.draw_text("77", self.font_symbol, WHITE, self.screen, rect.centerx, rect.centery)
            elif item_name == "TRAIN":
                pygame.draw.rect(self.screen, DARK_GRAY, (rect.centerx-35, rect.centery-20, 70, 40))
                self.draw_text("火車", self.font_small, WHITE, self.screen, rect.centerx, rect.centery - 10)
                self.draw_text("衝刺", self.font_small, WHITE, self.screen, rect.centerx, rect.centery + 10)
            elif item_name == "LOSE":
                pygame.draw.rect(self.screen, DARK_GRAY, (rect.centerx-35, rect.centery-20, 70, 40))
                self.draw_text("YOU", self.font_small, WHITE, self.screen, rect.centerx, rect.centery - 10)
                self.draw_text("DIE", self.font_small, WHITE, self.screen, rect.centerx, rect.centery + 10)
            else:
                self.draw_text(item_name[:6], self.font_small, info["color"], self.screen, rect.centerx, rect.centery)

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                mouse_pos = event.pos
                
                if self.state == "CONFIRM_CASH_OUT":
                    if self.btn_confirm.collidepoint(mouse_pos):
                        self.total_accumulated_cashout += self.credits
                        self.save_stats()
                        self.credits = 0
                        self.state = "IDLE"
                    elif self.btn_cancel.collidepoint(mouse_pos):
                        self.state = "IDLE"
                    return 
                        
                elif self.state == "CONFIRM_RESET":
                    if self.btn_confirm.collidepoint(mouse_pos):
                        self.total_accumulated_bets = 0
                        self.total_accumulated_cashout = 0
                        self.save_stats()
                        self.state = "IDLE"
                    elif self.btn_cancel.collidepoint(mouse_pos):
                        self.state = "IDLE"
                    return 

                if self.state in ["SPINNING", "TRAIN_SPINNING", "TRAIN_PAUSE", "TRAIN_BLINK", "TRAIN_BOUNCING"]:
                    if self.btn_start.collidepoint(mouse_pos):
                        self.fast_forward()
                    return 

                if self.state == "IDLE" or self.state == "SHOW_WIN":
                    if self.btn_insert_coin.collidepoint(mouse_pos):
                        self.credits += 10
                        if self.state == "SHOW_WIN":
                            self.state = "IDLE"
                            self.win_amount = 0
                            
                    elif self.btn_cash_out.collidepoint(mouse_pos):
                        if self.state == "IDLE":
                            if self.win_amount == 0 and self.credits > 0:
                                self.state = "CONFIRM_CASH_OUT"

                    elif self.btn_clear_bets.collidepoint(mouse_pos):
                        if self.state == "IDLE":
                            for opt in self.bets:
                                self.credits += self.bets[opt]
                                self.bets[opt] = 0
                            self.bets_modified_this_round = False
                            self.saved_bets_before_die = {opt: 0 for opt in BET_OPTIONS}
                            
                    elif self.btn_reset_stats.collidepoint(mouse_pos):
                        if self.state in ["IDLE", "SHOW_WIN"]:
                            if self.win_amount == 0:
                                self.state = "CONFIRM_RESET"
                            
                    elif self.btn_take_score.collidepoint(mouse_pos):
                        if self.win_amount > 0:
                            self.credits += self.win_amount
                            self.win_amount = 0
                            if self.state == "SHOW_WIN":
                                self.state = "IDLE"

                    else:
                        for opt, rect in self.bet_btn_rects.items():
                            if rect.collidepoint(mouse_pos):
                                if self.win_amount > 0:
                                    return
                                    
                                if self.credits >= 1:
                                    self.credits -= 1
                                    self.bets[opt] += 1
                                    self.bets_modified_this_round = True
                                    if self.state == "SHOW_WIN":
                                        self.state = "IDLE"
                                        
                    if self.btn_start.collidepoint(mouse_pos):
                        if self.win_amount > 0:
                            self.credits += self.win_amount
                            self.win_amount = 0
                            if self.state == "SHOW_WIN":
                                self.state = "IDLE"
                        else:
                            self.process_start()
                        
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    if self.state == "IDLE" or self.state == "SHOW_WIN":
                        if self.win_amount > 0:
                            self.credits += self.win_amount
                            self.win_amount = 0
                            if self.state == "SHOW_WIN":
                                self.state = "IDLE"
                        else:
                            self.process_start()
                    elif self.state in ["SPINNING", "TRAIN_SPINNING", "TRAIN_PAUSE", "TRAIN_BLINK", "TRAIN_BOUNCING", "GRAND_PRIZE_START"]:
                        self.fast_forward()

    def fast_forward(self):
        if self.state == "SPINNING":
            self.current_pos = self.target_pos
            self.steps_remaining = 0
            self.check_win()
        elif self.state == "TRAIN_SPINNING":
            while self.train_lights_left > 0:
                self.current_pos = (self.current_pos + 1) % 24
                self.train_lights_left -= 1
                item_name = BOARD_CONFIG[self.current_pos]
                if item_name in BET_OPTIONS and self.bets[item_name] > 0:
                    info = self.get_item_info(item_name)
                    win = self.bets[item_name] * info["odds"]
                    self.win_amount += win
            self.state = "SHOW_WIN"
        elif self.state in ["TRAIN_PAUSE", "TRAIN_BLINK", "TRAIN_BOUNCING"]:
            if self.state in ["TRAIN_PAUSE", "TRAIN_BLINK"]:
                self.state = "TRAIN_BOUNCING"
                num_bounces = random.randint(3, 10)
                valid_spots = [i for i in range(24) if i != 21]
                self.bouncing_targets = random.sample(valid_spots, num_bounces)
                self.extra_spins_left = num_bounces
            while self.bouncing_targets:
                self.current_pos = self.bouncing_targets.pop(0)
                self.multi_active_pos.append(self.current_pos)
                item_name = BOARD_CONFIG[self.current_pos]
                if item_name == "JACKPOT":
                    self.win_amount += int(self.jackpot)
                    self.jackpot = 500.0
                elif item_name in BET_OPTIONS and self.bets[item_name] > 0:
                    info = self.get_item_info(item_name)
                    win = self.bets[item_name] * info["odds"]
                    self.win_amount += win
                self.extra_spins_left -= 1
            self.state = "SHOW_WIN"
            self.is_blinking_on = True
        elif self.state == "GRAND_PRIZE_START":
            self.grand_prize_half = random.choice(["LEFT", "RIGHT"])
            self.multi_active_pos = self.left_half_pos if self.grand_prize_half == "LEFT" else self.right_half_pos
            self.evaluate_grand_prize()

    def evaluate_grand_prize(self):
        self.last_win_was_grand_prize = True
        win = 0
        for pos in self.multi_active_pos:
            item_name = BOARD_CONFIG[pos]
            if item_name in BET_OPTIONS and self.bets.get(item_name, 0) > 0:
                info = self.get_item_info(item_name)
                win += self.bets[item_name] * info["odds"]
        self.win_amount = win
        self.state = "SHOW_WIN"

    def process_start(self):
        total_bet = sum(self.bets.values())
        if total_bet == 0:
            total_saved = sum(self.saved_bets_before_die.values())
            if total_saved > 0:
                if self.credits >= total_saved:
                    self.credits -= total_saved
                    self.bets = self.saved_bets_before_die.copy()
                    self.total_accumulated_bets += total_saved
                    self.save_stats()
                    self.start_spin()
            return 
            
        if not self.bets_modified_this_round:
            if self.credits >= total_bet:
                self.credits -= total_bet
                self.total_accumulated_bets += total_bet
                self.save_stats()
                self.start_spin()
        else:
            self.total_accumulated_bets += total_bet
            self.save_stats()
            self.start_spin()

    def get_random_target_pos(self):
        r = random.random()
        if r < 0.05: return 3
        elif r < 0.25: return 21
        elif r < 0.35: return 9
        elif r < 0.38: return 4
        else:
            r2 = random.random() * 0.62
            if r2 < 0.10: return random.choice([15, 19, 7])
            elif r2 < 0.25: return random.choice([1, 13, 6, 18, 0, 12])
            elif r2 < 0.45: return random.choice([10, 16, 22])
            else: return random.choice([2, 5, 8, 11, 14, 17, 20, 23])

    def start_spin(self):
        self.win_amount = 0
        self.train_wins = []
        self.bets_modified_this_round = False 
        self.show_message = ""
        self.multi_active_pos = []
        self.saved_bets_before_die = {opt: 0 for opt in BET_OPTIONS}
        self.last_win_was_grand_prize = False
        
        if random.random() < 0.01:
            self.state = "GRAND_PRIZE_START"
            self.spin_timer = pygame.time.get_ticks()
            self.grand_prize_blink_count = 0
            self.is_blinking_left = True
            
            self.left_half_pos = [p for p in [3, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 15] if p not in (21, 9, 4)]
            self.right_half_pos = [p for p in [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] if p not in (21, 9, 4)]
            self.multi_active_pos = []
            
            return
        self.state = "SPINNING"
        self.target_pos = self.get_random_target_pos()
        steps_to_target = (self.target_pos - self.current_pos) % 24
        self.steps_remaining = 24 * 3 + steps_to_target
        self.spin_delay = 20 

    def update(self):
        if self.state == "SPINNING":
            current_time = pygame.time.get_ticks()
            if current_time - self.spin_timer > self.spin_delay:
                self.spin_timer = current_time
                self.current_pos = (self.current_pos + 1) % 24
                self.steps_remaining -= 1
                if self.steps_remaining < 15: self.spin_delay += 15 
                if self.steps_remaining <= 0:
                    self.current_pos = self.target_pos
                    self.check_win()
        elif self.state == "TRAIN_SPINNING":
            current_time = pygame.time.get_ticks()
            if current_time - self.spin_timer > 200:
                self.spin_timer = current_time
                self.current_pos = (self.current_pos + 1) % 24
                self.train_lights_left -= 1
                item_name = BOARD_CONFIG[self.current_pos]
                if item_name in BET_OPTIONS and self.bets[item_name] > 0:
                    info = self.get_item_info(item_name)
                    win = self.bets[item_name] * info["odds"]
                    self.win_amount += win
                if self.train_lights_left <= 0:
                    self.state = "SHOW_WIN"
        elif self.state == "TRAIN_PAUSE":
            current_time = pygame.time.get_ticks()
            if current_time - self.spin_timer > 1000:
                self.state = "TRAIN_BLINK"
                self.spin_timer = current_time
                self.train_blink_count = 0
                self.is_blinking_on = False
        elif self.state == "TRAIN_BLINK":
            current_time = pygame.time.get_ticks()
            if current_time - self.spin_timer > 500:
                self.spin_timer = current_time
                self.is_blinking_on = not self.is_blinking_on
                if self.is_blinking_on: self.train_blink_count += 1
                if self.train_blink_count >= 3:
                    self.state = "TRAIN_BOUNCING"
                    num_bounces = random.randint(3, 10)
                    self.bouncing_targets = random.sample([i for i in range(24) if i != 21], num_bounces)
                    self.extra_spins_left = num_bounces
                    self.bounce_steps = 0
        elif self.state == "TRAIN_BOUNCING":
            current_time = pygame.time.get_ticks()
            if self.bounce_steps == 0:
                if not self.bouncing_targets:
                    self.state = "SHOW_WIN"
                    return
                self.target_pos = self.bouncing_targets.pop(0)
                self.bounce_steps = random.randint(10, 20)
                self.bounce_delay = 50
                self.spin_timer = current_time
            elif current_time - self.spin_timer > self.bounce_delay:
                self.spin_timer = current_time
                self.current_pos = random.randint(0, 23)
                self.bounce_steps -= 1
                self.bounce_delay += 5
                if self.bounce_steps <= 0:
                    self.current_pos = self.target_pos
                    self.multi_active_pos.append(self.current_pos)
                    item_name = BOARD_CONFIG[self.current_pos]
                    if item_name == "JACKPOT":
                        self.win_amount += int(self.jackpot)
                        self.jackpot = 500.0
                    elif item_name in BET_OPTIONS and self.bets.get(item_name, 0) > 0:
                        info = self.get_item_info(item_name)
                        win = self.bets[item_name] * info["odds"]
                        self.win_amount += win
                    self.extra_spins_left -= 1
        elif self.state == "GRAND_PRIZE_START":
            current_time = pygame.time.get_ticks()
            if current_time - self.spin_timer > 150:
                self.spin_timer = current_time
                self.is_blinking_left = not self.is_blinking_left
                self.grand_prize_blink_count += 1
                if self.grand_prize_blink_count >= 20:
                    self.grand_prize_half = random.choice(["LEFT", "RIGHT"])
                    self.multi_active_pos = self.left_half_pos if self.grand_prize_half == "LEFT" else self.right_half_pos
                    self.evaluate_grand_prize()

    def check_win(self):
        item_name = BOARD_CONFIG[self.current_pos]
        if self.jackpot < 9999:
            self.jackpot += sum(self.bets.values()) * 0.1
        if item_name == "TRAIN":
            self.state = "TRAIN_PAUSE"
            self.spin_timer = pygame.time.get_ticks()
        elif item_name == "LOSE":
            self.win_amount = 0
            self.saved_bets_before_die = self.bets.copy()
            for opt in self.bets: self.bets[opt] = 0
            self.state = "SHOW_WIN"
        elif item_name == "JACKPOT":
            self.win_amount = int(self.jackpot)
            self.jackpot = 500.0
            self.state = "SHOW_WIN"
        else:
            if self.bets.get(item_name, 0) > 0:
                info = self.get_item_info(item_name)
                self.win_amount = self.bets[item_name] * info["odds"]
            self.state = "SHOW_WIN"

    def draw(self):
        self.screen.fill(BLACK)
        for i, rect in enumerate(self.board_rects):
            item_name = BOARD_CONFIG[i]
            if self.state == "GRAND_PRIZE_START":
                if self.is_blinking_left:
                    is_active = (i in self.left_half_pos)
                else:
                    is_active = (i in self.right_half_pos)
                self.draw_item_icon(item_name, rect, is_active)
            else:
                hide_all = (self.state == "TRAIN_BLINK" and not self.is_blinking_on)
                is_active = (i == self.current_pos or i in self.multi_active_pos)
                self.draw_item_icon(item_name, rect, is_active, hide_all)

        pygame.draw.rect(self.screen, DARK_GRAY, self.info_rect)
        pygame.draw.rect(self.screen, GOLD, self.info_rect, 4)
        self.draw_text("小瑪莉機台", self.font_title, WHITE, self.screen, self.info_rect.centerx, self.info_rect.top + 50)
        self.draw_text(f"總分: {self.credits}", self.font_large, YELLOW, self.screen, self.info_rect.centerx, self.info_rect.top + 100)
        self.draw_text(f"得分: {self.win_amount}", self.font_large, GREEN, self.screen, self.info_rect.centerx, self.info_rect.top + 140)
        
        if self.state == "GRAND_PRIZE_START":
            if self.is_blinking_left:
                self.draw_grand_prize_banner()
        elif self.state == "SHOW_WIN" and self.last_win_was_grand_prize:
            self.draw_grand_prize_banner()
            
        self.draw_text(f"JACKPOT: {int(self.jackpot)}", self.font_medium, CYAN, self.screen, self.info_rect.centerx, self.info_rect.bottom - 80)
        self.draw_text(f"總押分: {self.total_accumulated_bets}", self.font_small, ORANGE_COLOR, self.screen, self.info_rect.centerx, self.info_rect.bottom - 45)
        self.draw_text(f"總洗分: {self.total_accumulated_cashout}", self.font_small, PINK, self.screen, self.info_rect.centerx, self.info_rect.bottom - 20)

        for opt in BET_OPTIONS:
            rect = self.bet_btn_rects[opt]
            info = self.get_item_info(opt)
            pygame.draw.rect(self.screen, DARK_GRAY, rect)
            pygame.draw.rect(self.screen, WHITE, rect, 2)
            icon_rect = pygame.Rect(rect.left, rect.top+15, rect.width, 40)
            if info["has_image"] and opt in self.images:
                self.screen.blit(pygame.transform.smoothscale(self.images[opt], (35, 35)), pygame.transform.smoothscale(self.images[opt], (35, 35)).get_rect(center=icon_rect.center))
            else:
                self.draw_text(opt[:4], self.font_small, info["color"], self.screen, icon_rect.centerx, icon_rect.centery)
            self.draw_text(f"x{info['odds']}", self.font_small, WHITE, self.screen, rect.centerx, rect.top + 10)
            bet_val = self.bets[opt]
            pygame.draw.rect(self.screen, BLACK, (rect.left+5, rect.bottom-25, rect.width-10, 20))
            self.draw_text(str(bet_val), self.font_small, (GREEN if bet_val > 0 else WHITE), self.screen, rect.centerx, rect.bottom - 15)

        pygame.draw.rect(self.screen, DARK_RED, self.btn_insert_coin)
        pygame.draw.rect(self.screen, WHITE, self.btn_insert_coin, 3)
        self.draw_text("投幣", self.font_medium, WHITE, self.screen, self.btn_insert_coin.centerx, self.btn_insert_coin.centery)
        pygame.draw.rect(self.screen, PURPLE, self.btn_cash_out)
        pygame.draw.rect(self.screen, WHITE, self.btn_cash_out, 3)
        self.draw_text("洗分", self.font_medium, WHITE, self.screen, self.btn_cash_out.centerx, self.btn_cash_out.centery)
        pygame.draw.rect(self.screen, BLUE, self.btn_clear_bets)
        pygame.draw.rect(self.screen, WHITE, self.btn_clear_bets, 3)
        self.draw_text("退押", self.font_medium, WHITE, self.screen, self.btn_clear_bets.centerx, self.btn_clear_bets.centery)
        pygame.draw.rect(self.screen, ORANGE_COLOR, self.btn_take_score)
        pygame.draw.rect(self.screen, WHITE, self.btn_take_score, 3)
        self.draw_text("得分", self.font_medium, BLACK, self.screen, self.btn_take_score.centerx, self.btn_take_score.centery)
        pygame.draw.rect(self.screen, GREEN, self.btn_start)
        pygame.draw.rect(self.screen, WHITE, self.btn_start, 4)
        self.draw_text("啟動", self.font_large, BLACK, self.screen, self.btn_start.centerx, self.btn_start.centery)
        
        pygame.draw.rect(self.screen, DARK_GRAY, self.btn_reset_stats)
        pygame.draw.rect(self.screen, GRAY, self.btn_reset_stats, 1)
        self.draw_text("reset", self.font_tiny, GRAY, self.screen, self.btn_reset_stats.centerx, self.btn_reset_stats.centery)

        if self.state in ["CONFIRM_CASH_OUT", "CONFIRM_RESET"]:
            overlay = pygame.Surface((WINDOW_WIDTH, WINDOW_HEIGHT))
            overlay.set_alpha(180)
            overlay.fill(BLACK)
            self.screen.blit(overlay, (0, 0))
            dialog_rect = pygame.Rect(250, 300, 350, 200)
            pygame.draw.rect(self.screen, DARK_GRAY, dialog_rect)
            pygame.draw.rect(self.screen, WHITE, dialog_rect, 4)
            msg = "確定要洗分歸零嗎？" if self.state == "CONFIRM_CASH_OUT" else "確定要累計歸零嗎？"
            self.draw_text(msg, self.font_medium, WHITE, self.screen, dialog_rect.centerx, dialog_rect.top + 60)
            pygame.draw.rect(self.screen, GREEN, self.btn_confirm)
            self.draw_text("確定", self.font_medium, BLACK, self.screen, self.btn_confirm.centerx, self.btn_confirm.centery)
            pygame.draw.rect(self.screen, RED, self.btn_cancel)
            self.draw_text("取消", self.font_medium, WHITE, self.screen, self.btn_cancel.centerx, self.btn_cancel.centery)
        pygame.display.flip()

    def draw_grand_prize_banner(self):
        box_rect = pygame.Rect(self.info_rect.centerx - 100, self.info_rect.top + 190, 200, 45)
        pygame.draw.rect(self.screen, DARK_RED, box_rect)
        pygame.draw.rect(self.screen, GOLD, box_rect, 3)
        self.draw_text("爆發吧小宇宙", self.font_medium, YELLOW, self.screen, box_rect.centerx, box_rect.centery)

    def run(self):
        running = True
        while running:
            self.handle_events()
            self.update()
            self.draw()
            self.clock.tick(FPS)

    def get_item_info(self, name):
        for item in ITEMS:
            if item["name"] == name:
                return item
        return None

if __name__ == "__main__":
    game = LittleMary()
    game.run()
