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

interface EditingPackage {
  key: string;
  price_rub: number | string;
  generations: number | string;
}

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingPackage | null>(null);

  useEffect(() => {
    loadPackages();
  }, []);

  async function loadPackages() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/packages');
      const data = await response.json();

      if (data.success) {
        setPackages(data.packages || []);
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

  function startEditing(pkg: Package) {
    setEditingKey(pkg.key);
    setEditing({
      key: pkg.key,
      price_rub: pkg.price_rub,
      generations: pkg.generations,
    });
  }

  function cancelEditing() {
    setEditingKey(null);
    setEditing(null);
  }

  async function savePackage() {
    if (!editing) return;

    try {
      setSaving(true);

      const price_rub = parseInt(editing.price_rub as string);
      const generations = parseInt(editing.generations as string);

      if (isNaN(price_rub) || isNaN(generations)) {
        toast.error('Цена и количество генераций должны быть числами');
        return;
      }

      if (price_rub < 0 || generations < 0) {
        toast.error('Цена и количество генераций не могут быть отрицательными');
        return;
      }

      const response = await fetch(`/api/admin/packages/${editing.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_rub,
          generations,
          is_active: 1,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Пакет "${editing.key}" обновлен`);
        setEditingKey(null);
        setEditing(null);
        await loadPackages();
      } else {
        toast.error(data.error || 'Ошибка при сохранении');
      }
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Ошибка при сохранении пакета');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Управление Пакетами</h1>
        <p className="text-gray-600 mt-2">Редактируйте цены и количество генераций</p>
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
                    <TableHead>Генерации</TableHead>
                    <TableHead className="w-[180px]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((pkg) => (
                    <TableRow key={pkg.key}>
                      <TableCell className="font-medium">{pkg.title}</TableCell>
                      <TableCell>
                        {editingKey === pkg.key ? (
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={editing?.price_rub}
                            onChange={(e) =>
                              setEditing({
                                ...editing!,
                                price_rub: e.target.value,
                              })
                            }
                            className="w-[150px]"
                          />
                        ) : (
                          `${(pkg.price_rub / 100).toFixed(2)} ₽`
                        )}
                      </TableCell>
                      <TableCell>
                        {editingKey === pkg.key ? (
                          <Input
                            type="number"
                            min="0"
                            value={editing?.generations}
                            onChange={(e) =>
                              setEditing({
                                ...editing!,
                                generations: e.target.value,
                              })
                            }
                            className="w-[120px]"
                          />
                        ) : (
                          pkg.generations
                        )}
                      </TableCell>
                      <TableCell>
                        {editingKey === pkg.key ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={savePackage}
                              disabled={saving}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              Сохранить
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                              disabled={saving}
                            >
                              Отмена
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(pkg)}
                          >
                            Изменить
                          </Button>
                        )}
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
