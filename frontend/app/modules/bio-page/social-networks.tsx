import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandOnlyfans,
  IconBrandSnapchat,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconBrandX,
  IconBrandYoutube,
  type Icon,
} from '@tabler/icons-react';

export interface SocialNetwork {
  // Stored in PageLink#icon.
  id: string;
  name: string;
  icon: Icon;
  // Shown before the handle input, e.g. "instagram.com/".
  prefix: string;
  placeholder: string;
  hosts: string[];
  toUrl: (handle: string) => string;
}

const handle = (value: string) => value.trim().replace(/^@+/, '').replace(/\/+$/, '');

export const SOCIAL_NETWORKS: SocialNetwork[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: IconBrandInstagram,
    prefix: 'instagram.com/',
    placeholder: 'username',
    hosts: ['instagram.com'],
    toUrl: value => `https://www.instagram.com/${handle(value)}`,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: IconBrandTiktok,
    prefix: 'tiktok.com/@',
    placeholder: 'username',
    hosts: ['tiktok.com'],
    toUrl: value => `https://www.tiktok.com/@${handle(value)}`,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: IconBrandFacebook,
    prefix: 'facebook.com/',
    placeholder: 'page or profile',
    hosts: ['facebook.com', 'fb.com', 'fb.me'],
    toUrl: value => `https://www.facebook.com/${handle(value)}`,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: IconBrandLinkedin,
    prefix: 'linkedin.com/in/',
    placeholder: 'profile',
    hosts: ['linkedin.com', 'lnkd.in'],
    toUrl: value => `https://www.linkedin.com/in/${handle(value)}`,
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    icon: IconBrandSnapchat,
    prefix: 'snapchat.com/add/',
    placeholder: 'username',
    hosts: ['snapchat.com'],
    toUrl: value => `https://www.snapchat.com/add/${handle(value)}`,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: IconBrandYoutube,
    prefix: 'youtube.com/@',
    placeholder: 'channel',
    hosts: ['youtube.com', 'youtu.be'],
    toUrl: value => `https://www.youtube.com/@${handle(value)}`,
  },
  {
    id: 'x',
    name: 'X',
    icon: IconBrandX,
    prefix: 'x.com/',
    placeholder: 'username',
    hosts: ['x.com', 'twitter.com'],
    toUrl: value => `https://x.com/${handle(value)}`,
  },
  {
    id: 'onlyfans',
    name: 'OnlyFans',
    icon: IconBrandOnlyfans,
    prefix: 'onlyfans.com/',
    placeholder: 'username',
    hosts: ['onlyfans.com'],
    toUrl: value => `https://onlyfans.com/${handle(value)}`,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: IconBrandWhatsapp,
    prefix: 'wa.me/',
    placeholder: 'phone with country code',
    hosts: ['wa.me', 'whatsapp.com'],
    toUrl: value => `https://wa.me/${value.replace(/\D/g, '')}`,
  },
];

const BY_ID = new Map(SOCIAL_NETWORKS.map(network => [network.id, network]));

export function socialNetworkById(id?: string | null) {
  return id ? BY_ID.get(id) : undefined;
}

// The network a URL points to, if any (used to pick the icon of links
// added through the generic form).
export function detectSocialNetwork(url: string) {
  let host: string;
  try {
    host = new URL(url.trim()).hostname.replace(/^(www|m|mobile)\./, '');
  } catch {
    return undefined;
  }
  return SOCIAL_NETWORKS.find(network =>
    network.hosts.some(candidate => host === candidate || host.endsWith(`.${candidate}`))
  );
}

// What the user typed in a shortcut's field: a handle ("@marina",
// "marina") or the full profile URL pasted from the app.
export function socialLinkUrl(network: SocialNetwork, value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) && detectSocialNetwork(trimmed)?.id === network.id) {
    return trimmed;
  }
  return network.toUrl(trimmed);
}

export function isValidSocialValue(network: SocialNetwork, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return detectSocialNetwork(trimmed)?.id === network.id;
  if (network.id === 'whatsapp') return trimmed.replace(/\D/g, '').length >= 8;
  return /^@?[\w.-]{1,100}\/?$/.test(trimmed);
}
