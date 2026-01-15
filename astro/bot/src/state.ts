/**
 * In-memory состояние пользователей Telegram-бота
 */

export type UserStep =
  | 'waiting_photo'
  | 'waiting_prompt'
  | 'confirm'
  | 'generating';

export interface UserState {
  step: UserStep;
  photo_file_id: string | null;
  photo_path: string | null;
  prompt_text: string | null;
  last_generation_id: string | null;
  last_generation_status: string | null;
  last_update: number;
}

class StateManager {
  private states = new Map<number, UserState>();
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 час

  constructor() {
    // Очищаем старые состояния каждый час
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  /**
   * Получить или создать состояние пользователя
   */
  getState(userId: number): UserState {
    if (!this.states.has(userId)) {
      this.states.set(userId, {
        step: 'waiting_photo',
        photo_file_id: null,
        photo_path: null,
        prompt_text: null,
        last_generation_id: null,
        last_generation_status: null,
        last_update: Date.now(),
      });
    }

    const state = this.states.get(userId)!;
    state.last_update = Date.now();
    return state;
  }

  /**
   * Обновить состояние пользователя
   */
  setState(userId: number, updates: Partial<UserState>): void {
    const state = this.getState(userId);
    Object.assign(state, updates, { last_update: Date.now() });
  }

  /**
   * Сбросить состояние пользователя (новый диалог)
   */
  resetState(userId: number): void {
    this.states.set(userId, {
      step: 'waiting_photo',
      photo_file_id: null,
      photo_path: null,
      prompt_text: null,
      last_generation_id: null,
      last_generation_status: null,
      last_update: Date.now(),
    });
  }

  /**
   * Удалить состояние пользователя
   */
  deleteState(userId: number): void {
    this.states.delete(userId);
  }

  /**
   * Очистить неиспользованные состояния (старше 3 часов)
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 3 * 60 * 60 * 1000; // 3 часа

    for (const [userId, state] of this.states) {
      if (now - state.last_update > maxAge) {
        this.states.delete(userId);
        console.log(`[STATE] Cleaned up old state for user ${userId}`);
      }
    }
  }

  /**
   * Получить количество активных состояний
   */
  getActiveCount(): number {
    return this.states.size;
  }
}

export const stateManager = new StateManager();
