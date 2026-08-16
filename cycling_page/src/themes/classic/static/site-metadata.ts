interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const getBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL;
  return baseUrl === '/' ? '' : baseUrl;
};

const data: ISiteMetadataResult = {
  siteTitle: 'Kevin Henderson',
  siteUrl: 'https://kvnhndrsn.github.io',
  logo: 'https://github.com/kvnhndrsn.png',
  description: 'Cycling activities',
  navLinks: [
    {
      name: 'Summary',
      url: `${getBasePath()}/summary`,
    },
    {
      name: 'Blog',
      url: 'https://kvnhndrsn.github.io/notes/',
    },
    {
      name: 'About',
      url: 'https://github.com/kvnhndrsn',
    },
  ],
};

export default data;
