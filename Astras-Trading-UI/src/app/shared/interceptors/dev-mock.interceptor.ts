/**
 * DEV_AUTH: Мок-интерцептор для локальной разработки без Alor API.
 *
 * Перехватывает ВСЕ внешние HTTP-запросы (REST + GraphQL через Apollo HttpLink)
 * и возвращает статические мок-ответы, чтобы UI работал полностью офлайн.
 *
 * Активируется только при environment.devAuth === true.
 * В продакшене не используется.
 */
import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Observable, of } from 'rxjs';

@Injectable()
export class DevMockInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = req.url;

    // Пропускаем запросы к локальным ресурсам (assets, i18n и т.д.)
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('assets')) {
      return next.handle(req);
    }

    // Пропускаем относительные запросы без http
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return next.handle(req);
    }

    // --- GraphQL (Apollo HttpLink) ---
    // Apollo шлёт POST на /hyperion и /news/graphql
    if (url.includes('/hyperion')) {
      return this.mockGraphQL(req);
    }
    if (url.includes('/news/graphql')) {
      return this.mockNewsGraphQL(req);
    }

    // --- REST API: Market Data /md/v2/ ---
    if (url.includes('/md/v2/Securities/currencyPairs')) {
      return this.json([]);
    }
    if (url.includes('/md/v2/boards')) {
      return this.json([]);
    }
    if (url.includes('/md/v2/history')) {
      return this.json({ history: [], prev: null, next: null });
    }
    if (url.includes('/md/v2/Securities') && url.includes('/quotes')) {
      return this.json([]);
    }
    if (url.includes('/md/v2/Securities') && url.includes('/availableBoards')) {
      return this.json([]);
    }
    if (url.includes('/md/v2/Securities') && url.includes('/alltrades')) {
      return this.json([]);
    }
    // Одиночный инструмент: /md/v2/Securities/{exchange}/{symbol}
    if (url.match(/\/md\/v2\/Securities\/[A-Z]+\/[A-Za-z0-9.]+$/)) {
      return this.json(this.mockInstrument());
    }
    // Поиск инструментов: /md/v2/Securities?query=...
    if (url.includes('/md/v2/Securities')) {
      return this.json([]);
    }

    // --- REST API: Positions/Orders/Trades ---
    if (url.includes('/positions')) {
      return this.json([]);
    }
    if (url.includes('/stoporders')) {
      return this.json([]);
    }
    if (url.includes('/orders')) {
      return this.json([]);
    }
    if (url.includes('/trades')) {
      return this.json([]);
    }

    // --- REST API: Stats/History ---
    if (url.includes('/md/v2/stats/') || url.includes('/md/stats/')) {
      return this.json([]);
    }

    // --- REST API: Order Evaluation ---
    if (url.includes('/commandapi/warptrans')) {
      return this.json({
        portfolio: 'D39004',
        ticker: 'SBER',
        exchange: 'MOEX',
        quantityToSell: 0,
        quantityToBuy: 0,
        notMarginQuantityToSell: 0,
        notMarginQuantityToBuy: 0,
        orderEvaluation: 0,
        commission: 0
      });
    }

    // --- Client Data API ---
    if (url.includes('/client/v1.0/users/') && url.includes('/full-name')) {
      return this.json({ firstName: 'Dev', lastName: 'User', secondName: '' });
    }
    if (url.includes('/client/v1.0/users/') && url.includes('/all-portfolios')) {
      return this.json([
        {
          portfolio: 'D39004',
          tks: 'D39004',
          market: 'Stock',
          isVirtual: false,
          agreement: 'AG0001'
        }
      ]);
    }
    if (url.includes('/client/v2.0/agreements/') && url.includes('/dynamics')) {
      return this.json({ portfolioValues: [] });
    }
    if (url.includes('/client/v1.0/agreements/') && url.includes('/reports')) {
      return this.json({ list: [] });
    }
    if (url.includes('/client/v1.0/agreements/') && url.includes('/report/')) {
      return this.json({});
    }

    // --- Remote Settings Storage ---
    if (url.includes('/identity/v5/UserSettings')) {
      if (req.method === 'GET') {
        if (url.includes('/group/')) {
          return this.json([]);
        }
        return this.json({ UserSettings: null });
      }
      if (req.method === 'PUT') {
        return this.text('OK');
      }
      if (req.method === 'DELETE') {
        return this.text('OK');
      }
    }

    // --- Auth endpoints (уже обработаны devAuth, но на всякий случай) ---
    if (url.includes('/auth/actions')) {
      return this.json({ jwt: 'dev-mock-jwt' });
    }

    // --- AI Chat ---
    if (url.includes('/aichat/')) {
      return this.json({ answer: 'DEV MODE: AI Chat отключён в офлайн-режиме.' });
    }

    // --- Invest Ideas ---
    if (url.includes('/invest-ideas')) {
      return this.json({ items: [], total: 0 });
    }

    // --- CMS API ---
    if (url.includes('/cmsapi')) {
      return this.json({});
    }

    // --- Warp URL ---
    if (url.includes('warp.alor')) {
      return this.json({});
    }

    // --- Teamly ---
    if (url.includes('/teamly/')) {
      return this.json({ data: [] });
    }

    // --- Icons Storage ---
    if (url.includes('storage.alorbroker.ru')) {
      return this.json({});
    }

    // --- Fallback: любой другой внешний запрос ---
    console.warn(`[DevMockInterceptor] Неизвестный внешний запрос перехвачен: ${req.method} ${url}`);
    return this.json({});
  }

  // --- Хелперы для формирования мок-ответов ---

  private json(body: any): Observable<HttpEvent<any>> {
    return of(new HttpResponse({ status: 200, body }));
  }

  private text(body: string): Observable<HttpEvent<any>> {
    return of(new HttpResponse({ status: 200, body }));
  }

  private mockInstrument(): Record<string, any> {
    return {
      symbol: 'SBER',
      shortname: 'Сбербанк',
      description: 'Сбербанк России ПАО ао',
      exchange: 'MOEX',
      type: 'stock',
      currency: 'RUB',
      minstep: 0.01,
      lotsize: 10,
      pricestep: 0.01,
      cfiCode: 'ESVUFR',
      tradingStatus: 17,
      tradingStatusInfo: 'NormalPeriod',
      board: 'TQBR',
      primaryBoard: 'TQBR',
      isin: 'RU0009029540',
      marginbuy: 100,
      marginsell: 100
    };
  }

  /**
   * Мок для GraphQL-запросов к /hyperion.
   * Парсит тело запроса и возвращает пустые результаты по имени операции.
   */
  private mockGraphQL(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    const body = req.body;
    const operationName = body?.operationName || '';

    // Маппинг операций на пустые ответы
    const emptyResults: Record<string, any> = {
      getInstruments: { data: { instruments: { edges: [], pageInfo: { hasNextPage: false } } } },
      getBonds: { data: { bonds: { edges: [], pageInfo: { hasNextPage: false } } } },
      getBondsYieldCurve: { data: { bondsYieldCurve: [] } },
      getMarketTrends: { data: { marketTrends: [] } },
      getEvents: { data: { events: { edges: [], pageInfo: { hasNextPage: false } } } },
      getFinance: { data: { finance: null } },
      getDividends: { data: { dividends: [] } },
      getInstrumentsCorrelation: { data: { instrumentsCorrelation: [] } },
    };

    if (emptyResults[operationName]) {
      return this.json(emptyResults[operationName]);
    }

    // Fallback: возвращаем пустой data для любой неизвестной операции
    console.warn(`[DevMockInterceptor] Неизвестная GraphQL операция: ${operationName}`);
    return this.json({ data: {} });
  }

  /**
   * Мок для GraphQL-запросов к /news/graphql.
   */
  private mockNewsGraphQL(_req: HttpRequest<any>): Observable<HttpEvent<any>> {
    return this.json({
      data: {
        news: {
          nodes: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null
          }
        }
      }
    });
  }
}
