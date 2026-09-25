import fixture from '../fixtures/draft-default.json';

describe('Hosted Test draft controls', () => {
  it('uses the Test API, preserves mode in navigation, and distinguishes socket events from polling', () => {
    let socket;
    let reads = 0;
    cy.intercept(
      { hostname: /execute-api\..*amazonaws\.com$/, pathname: '/test/**' },
      (req) => {
        const path = new URL(req.url).pathname.replace('/test', '');
        if (path === '/seasons')
          return req.reply({
            storageVersion: 'v2',
            defaultSeason: 'season3',
            seasons: [
              {
                id: 'season3',
                label: 'Test draft',
                status: 'preseason',
                writersEnabled: true,
              },
            ],
          });
        if (path === '/players') return req.reply(fixture.players);
        if (path === '/draft/state') {
          reads++;
          return req.reply(fixture.draftState);
        }
        throw Error(`Unexpected Test route: ${path}`);
      }
    );
    cy.visit('/draft/Ryan?draftTest=1', {
      onBeforeLoad(win) {
        win.WebSocket = class {
          static OPEN = 1;
          static CONNECTING = 0;
          readyState = 0;
          constructor(url) {
            expect(url).to.contain('/test');
            socket = this;
            win.setTimeout(() => {
              this.readyState = 1;
              this.onopen?.();
            }, 50);
          }
          close() {
            this.readyState = 3;
            this.onclose?.();
          }
          send() {
            this.onmessage?.({
              data: JSON.stringify({ type: 'draftUpdate', payload: {} }),
            });
          }
        };
      },
    });
    cy.get('[data-test="test-socket-status"]').should('contain', 'Connected');
    cy.contains('WebSocket only (pause polling)')
      .find('input')
      .should('be.checked');
    cy.get('[data-test="test-socket-events"]').should('contain', '0');
    cy.contains('button', 'Send test event').click();
    cy.get('[data-test="test-socket-events"]').should('contain', '1');
    cy.then(() => expect(reads).to.be.greaterThan(1));
    cy.contains('button', 'Disconnect').click();
    cy.get('[data-test="test-socket-status"]').should(
      'contain',
      'Disconnected'
    );
    cy.contains('button', 'Reconnect').click();
    cy.get('[data-test="test-socket-status"]').should('contain', 'Connected');
    cy.then(() => expect(socket.readyState).to.eq(1));
    cy.get('a[href="/draft/Cooper?draftTest=1"]').should(
      'have.attr',
      'target',
      '_blank'
    );
  });
});
