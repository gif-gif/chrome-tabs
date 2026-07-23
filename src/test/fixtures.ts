import type { BrowserWindow } from '../types'

export const windows: BrowserWindow[] = [
  {
    id: 10,
    focused: true,
    tabs: [
      {
        id: 101,
        windowId: 10,
        index: 0,
        active: true,
        title: 'GitHub - Chrome Tabs',
        url: 'https://github.com/example/chrome-tabs',
        favIconUrl: 'https://github.com/favicon.ico',
      },
      {
        id: 102,
        windowId: 10,
        index: 1,
        active: false,
        title: 'Mail Inbox',
        url: 'https://mail.example.com/inbox?TOKEN=SECRET',
        favIconUrl: 'https://mail.example.com/favicon.ico',
      },
    ],
  },
  {
    id: 20,
    focused: false,
    tabs: [
      {
        id: 201,
        windowId: 20,
        index: 0,
        active: true,
        title: 'Project Documentation',
        url: 'https://docs.example.com/project/overview',
        favIconUrl: 'https://docs.example.com/favicon.ico',
      },
    ],
  },
]
