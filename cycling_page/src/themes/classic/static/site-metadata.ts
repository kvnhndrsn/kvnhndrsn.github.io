interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
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
};

export default data;
