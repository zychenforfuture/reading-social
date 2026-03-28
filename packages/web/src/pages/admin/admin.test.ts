import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(QueryClientProvider, { client: queryClient }, children)
);

describe('Admin - AdminDashboard', () => {
  it('should render AdminDashboard', async () => {
    const module = await import('./AdminDashboard.js');
    const AdminDashboard = module.default;
    const { container } = render(React.createElement(AdminDashboard), { wrapper });
    expect(container.innerHTML).toBeTruthy();
  });
});

describe('Admin - AdminUsers', () => {
  it('should render AdminUsers', async () => {
    const module = await import('./AdminUsers.js');
    const AdminUsers = module.default;
    const { container } = render(React.createElement(AdminUsers), { wrapper });
    expect(container.innerHTML).toBeTruthy();
  });
});

describe('Admin - AdminDocuments', () => {
  it('should render AdminDocuments', async () => {
    const module = await import('./AdminDocuments.js');
    const AdminDocuments = module.default;
    const { container } = render(React.createElement(AdminDocuments), { wrapper });
    expect(container.innerHTML).toBeTruthy();
  });
});

describe('Admin - AdminComments', () => {
  it('should render AdminComments', async () => {
    const module = await import('./AdminComments.js');
    const AdminComments = module.default;
    const { container } = render(React.createElement(AdminComments), { wrapper });
    expect(container.innerHTML).toBeTruthy();
  });
});
