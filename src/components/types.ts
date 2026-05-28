/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Domain {
  id: string;
  domain: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MailAddress {
  name: string;
  address: string;
}

export interface Message {
  id: string;
  accountId: string;
  msgid: string;
  from: MailAddress;
  to: MailAddress[];
  subject: string;
  intro: string;
  seen: boolean;
  isDeleted: boolean;
  hasAttachments: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDetail extends Message {
  text: string;
  html: string[];
}

export interface VaultItem {
  address: string;
  password: string;
  api: string;
  date: string;
}
