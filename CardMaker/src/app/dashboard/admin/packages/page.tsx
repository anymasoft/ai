'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Package {
  key: string;
  title: string;
  price_rub: number;
  generations: number;
  is_active: number;
  created_at: number;
  updated_at: number;
}

interface EditState {
  [key: string]: {
    price_rub: number;
    generations: number;
    is_active: number;
  };
}

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [values, setValues] = useState<EditState>({});

  console.log('[AdminPackagesPage] Rendered. Packages:', packages.length, 'Values:', Object.keys(values).length);

  useEffect(() => {
    loadPackages();
  }, []);

  async function loadPackages() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/packages');
      const data = await response.json();

      if (data.success) {
        const pkgs = data.packages || [];
        setPackages(pkgs);

        // Инициализируем значения для каждого пакета
        const newValues: EditState = {};
        pkgs.forEach((pkg: Package) => {
          newValues[pkg.key] = {
            price_rub: pkg.price_rub,
            generations: pkg.generations,
            is_active: pkg.is_active,
          };
        });
        setValues(newValues);
      } else {
        toast.error('Ошибка при загрузке пакетов');
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      toast.error('Ошибка при загрузке пакетов');
    } finally {
      setLoading(false);
    }
  }

  async function savePackage(key: string) {
    try {
      setSaving(key);

      const pkg = values[key];
      if (!pkg) return;

      const response = await fetch(`/api/admin/packages/by-key?key=${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_rub: pkg.price_rub,
          generations: pkg.generations,
          is_active: pkg.is_active,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Пакет "${key}" обновлен`);
        await loadPackages();
      } else {
        toast.error(data.error || 'Ошибка при сохранении');
      }
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Ошибка при сохранении пакета');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Управление Пакетами</h1>
        <p className="text-gray-600 mt-2">Редактируйте цены и количество описаний</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Доступные Пакеты</CardTitle>
          <CardDescription>
            Изменения будут применены сразу на все новые покупки
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Цена (₽)</TableHead>
                    <TableHead>Описания</TableHead>
                    <TableHead>Активен</TableHead>
                    <TableHead className="w-[180px]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((pkg) => (
                    <TableRow key={pkg.key}>
                      <TableCell className="font-medium">{pkg.title}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={values[pkg.key]?.price_rub || 0}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [pkg.key]: {
                                ...values[pkg.key],
                                price_rub: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-24 border border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={values[pkg.key]?.generations || 0}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [pkg.key]: {
                                ...values[pkg.key],
                                generations: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-20 border border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={values[pkg.key]?.is_active === 1}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [pkg.key]: {
                                ...values[pkg.key],
                                is_active: e.target.checked ? 1 : 0,
                              },
                            })
                          }
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => savePackage(pkg.key)}
                          disabled={saving === pkg.key}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {saving === pkg.key && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          Сохранить
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
