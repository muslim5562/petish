import { MapPin, PawPrint } from "lucide-react";
export type PublicPet = {
  publicId: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string;
  age: string;
  area: string | null;
  description: string | null;
  imageUrl: string | null;
};
export default function PublicCard({
  pet,
  previewImage,
}: {
  pet: PublicPet;
  previewImage?: string;
}) {
  return (
    <article className="public-card">
      <div className="public-photo">
        {pet.imageUrl ? (
          <img src={previewImage || pet.imageUrl} alt={pet.name} />
        ) : (
          <PawPrint size={80} />
        )}
      </div>
      <div className="public-copy">
        <span className="eyebrow">A LITTLE INTRODUCTION</span>
        <h1>
          Meet {pet.name}
          <span>.</span>
        </h1>
        <p className="public-meta">
          {pet.breed || (pet.species === "DOG" ? "Dog" : "Cat")} · {pet.age}
          {pet.sex !== "UNKNOWN"
            ? ` · ${pet.sex === "MALE" ? "Male" : "Female"}`
            : ""}
        </p>
        {pet.description && (
          <p className="public-description">{pet.description}</p>
        )}
        {pet.area && (
          <p className="area">
            <MapPin size={17} />
            {pet.area}
          </p>
        )}
      </div>
    </article>
  );
}
