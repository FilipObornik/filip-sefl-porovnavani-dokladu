import { useAppContext } from '@/state/app-context';
import OverviewRow from './OverviewRow';

export default function OverviewTable() {
  const { state } = useAppContext();
  const rows = state.comparisonRows;

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-lg">
        Žádné řádky. Klikněte na <span className="font-semibold">Přidat řádek</span>.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 text-sm text-gray-700">
            <th className="px-3 py-2 text-left font-semibold min-w-[140px]">
              Poznámka
            </th>
            <th className="px-3 py-2 text-center font-semibold min-w-[180px] bg-sky-50">
              Faktura
            </th>
            <th className="px-3 py-2 text-center font-semibold min-w-[180px] bg-emerald-50">
              Příjemka
            </th>
            <th className="px-3 py-2 text-center font-semibold">
              Zpracuj
            </th>
            <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">
              Cena (fak. / příj.)
            </th>
            <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">
              DPH (fak. / příj.)
            </th>
            <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">
              Doklad uzavřen
            </th>
            <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">
              Stav
            </th>
            <th className="px-3 py-2 text-center font-semibold">
              Detail
            </th>
            <th className="px-3 py-2 text-center font-semibold w-10">
              {/* Smazat column - no header */}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OverviewRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
