import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

const routes: Routes = [
  {
    path: 'app',
    component: LayoutComponent,
    children: [
      { path: 'home', loadChildren: () => import('./home/home.module').then((m) => m.HomePageModule) },
      { path: 'it-home', loadChildren: () => import('./it-home/it-home.module').then((m) => m.ItHomePageModule) },
      { path: 'user-home', loadChildren: () => import('./user-home/user-home.module').then((m) => m.UserHomePageModule) },
      {
    path: 'it-inventory', loadChildren: () => import('./it-inventory/it-inventory.module').then( m => m.ItInventoryPageModule)},
    ],
  },
  {
    path: '',
    redirectTo: 'app/home',
    pathMatch: 'full',
  },
  
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
