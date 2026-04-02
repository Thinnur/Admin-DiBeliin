import { Input } from '@/components/ui/input';
import { formatCategoryLabel } from '@/lib/financeCategories';

interface TransactionCategoryInputProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function TransactionCategoryInput({
    id,
    value,
    onChange,
    suggestions,
    placeholder = 'Ketik atau pilih kategori',
    className,
    disabled = false,
}: TransactionCategoryInputProps) {
    const listId = `${id}-suggestions`;

    return (
        <>
            <Input
                id={id}
                list={listId}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className={className}
                disabled={disabled}
            />
            <datalist id={listId}>
                {suggestions.map((suggestion) => (
                    <option
                        key={suggestion}
                        value={suggestion}
                        label={formatCategoryLabel(suggestion)}
                    />
                ))}
            </datalist>
        </>
    );
}
