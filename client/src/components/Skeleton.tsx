import "./Skeleton.css";

interface Props {
    lines?: number;
}

export default function Skeleton({ lines = 4 }: Props) {
    return (
        <div className="skeleton-container fade-in">
            <div className="skeleton skeleton-title" />
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className="skeleton skeleton-text" />
            ))}
            <div className="skeleton skeleton-block" />
        </div>
    );
}
