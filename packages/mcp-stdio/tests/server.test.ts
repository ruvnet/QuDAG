import { QuDagMcpServer } from '../src/server';

describe('QuDagMcpServer', () => {
  let server: QuDagMcpServer;

  beforeEach(() => {
    server = new QuDagMcpServer();
  });

  it('should create a server instance', () => {
    expect(server).toBeInstanceOf(QuDagMcpServer);
  });

  it('should have a server property', () => {
    const internalServer = server.getServer();
    expect(internalServer).toBeDefined();
  });

  it('should have server info', () => {
    const internalServer = server.getServer();
    expect((internalServer as any).serverInfo).toMatchObject({
      name: 'qudag-mcp-stdio',
      version: '0.1.0',
    });
  });
});
