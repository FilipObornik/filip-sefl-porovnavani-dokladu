import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode: number | undefined;
}

function ErrorPage({ statusCode }: ErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg text-gray-600">
        {statusCode
          ? `Chyba ${statusCode} na serveru`
          : 'Nastala chyba v aplikaci'}
      </p>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default ErrorPage;
