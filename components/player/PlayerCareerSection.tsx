import Image from 'next/image';

export type CareerTransfer = {
  date: string;
  type: string | null;
  from_team: string;
  from_team_logo: string | null;
  to_team: string;
  to_team_logo: string | null;
};

export type PlayerCareerSectionProps = {
  transfers: CareerTransfer[];
  height_cm: number | null;
  weight_kg: number | null;
  birth_place: string | null;
  birth_country: string | null;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  year: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
});

function ClubChip({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="bg-muted relative size-6 shrink-0 overflow-hidden rounded-full">
        {logo ? (
          <Image
            src={logo}
            alt=""
            fill
            sizes="24px"
            className="object-contain p-0.5"
            unoptimized
          />
        ) : null}
      </div>
      <span className="truncate text-sm">{name}</span>
    </div>
  );
}

export function PlayerCareerSection({
  transfers,
  height_cm,
  weight_kg,
  birth_place,
  birth_country,
}: PlayerCareerSectionProps) {
  const hasBio = height_cm || weight_kg || birth_place || birth_country;
  const hasCareer = transfers.length > 0;

  if (!hasBio && !hasCareer) return null;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <h2 className="mb-4 text-base font-semibold">Profil & carrière</h2>

      {hasBio && (
        <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {height_cm != null && (
            <div>
              <dt className="text-muted-foreground text-[10px] tracking-wide uppercase">
                Taille
              </dt>
              <dd className="text-foreground text-sm tabular-nums">
                {height_cm} cm
              </dd>
            </div>
          )}
          {weight_kg != null && (
            <div>
              <dt className="text-muted-foreground text-[10px] tracking-wide uppercase">
                Poids
              </dt>
              <dd className="text-foreground text-sm tabular-nums">
                {weight_kg} kg
              </dd>
            </div>
          )}
          {birth_place && (
            <div>
              <dt className="text-muted-foreground text-[10px] tracking-wide uppercase">
                Lieu de naissance
              </dt>
              <dd className="text-foreground text-sm">{birth_place}</dd>
            </div>
          )}
          {birth_country && (
            <div>
              <dt className="text-muted-foreground text-[10px] tracking-wide uppercase">
                Pays
              </dt>
              <dd className="text-foreground text-sm">{birth_country}</dd>
            </div>
          )}
        </dl>
      )}

      {hasCareer && (
        <>
          <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
            Transferts ({transfers.length})
          </h3>
          <ul className="space-y-3">
            {transfers.map((t, i) => (
              <li
                key={i}
                className="border-border/60 border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {DATE_FMT.format(new Date(t.date))}
                  </p>
                  {t.type && (
                    <span className="text-primary text-xs font-semibold">
                      {t.type}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <ClubChip name={t.from_team} logo={t.from_team_logo} />
                  <span className="text-muted-foreground text-xs">→</span>
                  <ClubChip name={t.to_team} logo={t.to_team_logo} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
