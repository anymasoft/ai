"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useI18n } from "@/providers/I18nProvider"

const accountFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  language: z.enum(["en", "ru"]).default("en"),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
})

type AccountFormValues = z.infer<typeof accountFormSchema>

export default function AccountSettings() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { dict } = useI18n();

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      username: "",
      language: "en",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  // Populate form with session data
  useEffect(() => {
    if (session?.user?.id) {
      const fullName = session.user.name || "";
      const nameParts = fullName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Fetch user language from API
      fetch("/api/user/language")
        .then((res) => res.json())
        .then((data) => {
          form.reset({
            firstName,
            lastName,
            email: session.user.email || "",
            username: session.user.email?.split("@")[0] || "",
            language: data.language || "en",
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
        })
        .catch((error) => {
          console.error("Failed to fetch user language:", error);
          form.reset({
            firstName,
            lastName,
            email: session.user.email || "",
            username: session.user.email?.split("@")[0] || "",
            language: "en",
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
        });
    }
  }, [session, form]);

  async function onSubmit(data: AccountFormValues) {
    setIsLoading(true);

    try {
      // Save language preference
      const res = await fetch("/api/user/language", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ language: data.language }),
      });

      if (!res.ok) {
        throw new Error("Failed to update language preference");
      }

      toast(dict.settingsSaved, {
        description: dict.settingsSavedDescription,
        duration: 3000,
        className: "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg text-neutral-900 dark:text-neutral-100",
        icon: null
      });

      // Refresh the page to apply language changes after toast is visible
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast(dict.saveFailed, {
        description: dict.saveFailedDescription,
        duration: 3000,
        className: "bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 shadow-lg text-neutral-900 dark:text-neutral-100",
        icon: null
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
        <div>
          <h1 className="text-3xl font-bold">{dict.accountSettings}</h1>
          <p className="text-muted-foreground">
            {dict.manageAccount}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{dict.personalInformation}</CardTitle>
                <CardDescription>
                  {dict.personalInformationDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{dict.firstName}</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your first name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{dict.lastName}</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{dict.email}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter your email" {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{dict.username}</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{dict.preferences}</CardTitle>
                <CardDescription>
                  {dict.preferencesDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{dict.analysisLanguage}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">🇬🇧 English</SelectItem>
                          <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {dict.analysisLanguageDescription}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{dict.changePassword}</CardTitle>
                <CardDescription>
                  {dict.changePasswordDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{dict.currentPassword}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter current password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{dict.newPassword}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{dict.confirmPassword}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{dict.dangerZone}</CardTitle>
                <CardDescription>
                  {dict.dangerZoneDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Separator />
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{dict.deleteAccount}</h4>
                    <p className="text-sm text-muted-foreground">
                      {dict.deleteAccountDescription}
                    </p>
                  </div>
                  <Button variant="destructive" type="button" className="cursor-pointer">
                    {dict.deleteAccount}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex space-x-2">
              <Button type="submit" disabled={isLoading} className={`cursor-pointer min-w-[140px] ${isLoading ? 'opacity-60' : ''}`}>
                {isLoading ? dict.saving : dict.saveChanges}
              </Button>
              <Button variant="outline" type="reset" disabled={isLoading} className="cursor-pointer">{dict.cancel}</Button>
            </div>
          </form>
        </Form>
      </div>
  )
}
